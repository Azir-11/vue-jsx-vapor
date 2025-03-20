import {
  defaultOnError,
  defaultOnWarn,
  type TransformOptions as BaseTransformOptions,
  type CommentNode,
  type CompilerCompatOptions,
  type SimpleExpressionNode,
} from '@vue/compiler-dom'
import { EMPTY_OBJ, extend, isArray, isString, NOOP } from '@vue/shared'
import {
  DynamicFlag,
  IRNodeTypes,
  type BlockIRNode,
  type HackOptions,
  type IRDynamicInfo,
  type IRSlots,
  type OperationNode,
  type RootIRNode,
  type RootNode,
  type SetEventIRNode,
} from './ir'
import { newBlock, newDynamic } from './transforms/utils'
import { findProp, getText, isConstantExpression, isTemplate } from './utils'
import type { JSXAttribute, JSXElement, JSXFragment } from '@babel/types'

export type NodeTransform = (
  node: BlockIRNode['node'],
  context: TransformContext<BlockIRNode['node']>,
) => void | (() => void) | (() => void)[]

export type DirectiveTransform = (
  dir: JSXAttribute,
  node: JSXElement,
  context: TransformContext<JSXElement>,
) => DirectiveTransformResult | void

export interface DirectiveTransformResult {
  key: SimpleExpressionNode
  value: SimpleExpressionNode
  modifier?: '.' | '^'
  runtimeCamelize?: boolean
  handler?: boolean
  handlerModifiers?: SetEventIRNode['modifiers']
  model?: boolean
  modelModifiers?: string[]
}

// A structural directive transform is technically also a NodeTransform;
// Only v-if and v-for fall into this category.
export type StructuralDirectiveTransform = (
  node: JSXElement,
  dir: JSXAttribute,
  context: TransformContext,
) => void | (() => void)

export type TransformOptions = HackOptions<BaseTransformOptions>
const defaultOptions = {
  filename: '',
  prefixIdentifiers: false,
  hoistStatic: false,
  hmr: false,
  cacheHandlers: false,
  nodeTransforms: [],
  directiveTransforms: {},
  transformHoist: null,
  isBuiltInComponent: NOOP,
  isCustomElement: NOOP,
  expressionPlugins: [],
  scopeId: null,
  slotted: true,
  ssr: false,
  inSSR: false,
  ssrCssVars: ``,
  bindingMetadata: EMPTY_OBJ,
  inline: false,
  isTS: false,
  onError: defaultOnError,
  onWarn: defaultOnWarn,
}

export class TransformContext<
  T extends BlockIRNode['node'] = BlockIRNode['node'],
> {
  parent: TransformContext<RootNode | JSXElement | JSXFragment> | null = null
  root: TransformContext<RootNode>
  index: number = 0

  block: BlockIRNode = this.ir.block
  options: Required<
    Omit<TransformOptions, 'filename' | keyof CompilerCompatOptions>
  >

  template: string = ''
  childrenTemplate: (string | null)[] = []
  dynamic: IRDynamicInfo = this.ir.block.dynamic

  inVOnce: boolean = false
  inVFor: number = 0

  comment: CommentNode[] = []
  component: Set<string> = this.ir.component
  directive: Set<string> = this.ir.directive

  slots: IRSlots[] = []

  private globalId = 0

  constructor(
    public ir: RootIRNode,
    public node: T,
    options: TransformOptions = {},
  ) {
    this.options = extend({}, defaultOptions, options)
    this.root = this as TransformContext<RootNode>
  }

  enterBlock(ir: BlockIRNode, isVFor: boolean = false): () => void {
    const { block, template, dynamic, childrenTemplate, slots } = this
    this.block = ir
    this.dynamic = ir.dynamic
    this.template = ''
    this.childrenTemplate = []
    this.slots = []
    isVFor && this.inVFor++
    return () => {
      // exit
      this.registerTemplate()
      this.block = block
      this.template = template
      this.dynamic = dynamic
      this.childrenTemplate = childrenTemplate
      this.slots = slots
      isVFor && this.inVFor--
    }
  }

  increaseId = () => this.globalId++
  reference() {
    if (this.dynamic.id !== undefined) return this.dynamic.id
    this.dynamic.flags |= DynamicFlag.REFERENCED
    return (this.dynamic.id = this.increaseId())
  }

  pushTemplate(content: string) {
    const existing = this.ir.template.indexOf(content)
    if (existing !== -1) return existing
    this.ir.template.push(content)
    return this.ir.template.length - 1
  }

  registerTemplate() {
    if (!this.template) return -1
    const id = this.pushTemplate(this.template)
    return (this.dynamic.template = id)
  }

  registerEffect(
    expressions: SimpleExpressionNode[],
    ...operations: OperationNode[]
  ) {
    expressions = expressions.filter((exp) => !isConstantExpression(exp))
    if (this.inVOnce || expressions.length === 0) {
      return this.registerOperation(...operations)
    }
    const existing = this.block.effect.find((e) =>
      isSameExpression(e.expressions, expressions),
    )
    if (existing) {
      existing.operations.push(...operations)
    } else {
      this.block.effect.push({
        expressions,
        operations,
      })
    }

    function isSameExpression(
      a: SimpleExpressionNode[],
      b: SimpleExpressionNode[],
    ) {
      if (a.length !== b.length) return false
      return a.every((exp, i) => exp.content === b[i].content)
    }
  }

  registerOperation(...node: OperationNode[]) {
    this.block.operation.push(...node)
  }

  create<E extends T>(node: E, index: number): TransformContext<E> {
    return Object.assign(Object.create(TransformContext.prototype), this, {
      node,
      parent: this as any,
      index,

      template: '',
      childrenTemplate: [],
      dynamic: newDynamic(),
    } satisfies Partial<TransformContext<T>>)
  }
}

// AST -> IR
export function transform(
  node: RootNode,
  options: TransformOptions = {},
): RootIRNode {
  const ir: RootIRNode = {
    type: IRNodeTypes.ROOT,
    node,
    source: node.source,
    template: [],
    component: new Set(),
    directive: new Set(),
    block: newBlock(node),
    hasTemplateRef: false,
  }

  const context = new TransformContext(ir, node, options)

  transformNode(context)

  return ir
}

export function transformNode(context: TransformContext<BlockIRNode['node']>) {
  let { node } = context

  // apply transform plugins
  const { nodeTransforms } = context.options
  const exitFns = []
  for (const nodeTransform of nodeTransforms) {
    const onExit = nodeTransform(node, context)
    if (onExit) {
      if (isArray(onExit)) {
        exitFns.push(...onExit)
      } else {
        exitFns.push(onExit)
      }
    }
    if (!context.node) {
      // node was removed
      return
    } else {
      // node may have been replaced
      node = context.node
    }
  }

  // exit transforms
  context.node = node
  let i = exitFns.length
  while (i--) {
    exitFns[i]()
  }

  if (context.node.type === IRNodeTypes.ROOT) {
    context.registerTemplate()
  }
}

export function createStructuralDirectiveTransform(
  name: string | string[],
  fn: StructuralDirectiveTransform,
): NodeTransform {
  const matches = (n: string) =>
    isString(name) ? n === name : name.includes(n)

  return (node, context) => {
    if (node.type === 'JSXElement') {
      const {
        openingElement: { attributes },
      } = node
      // structural directive transforms are not concerned with slots
      // as they are handled separately in vSlot.ts
      if (isTemplate(node) && findProp(node, 'v-slot')) {
        return
      }
      const exitFns = []
      for (const prop of attributes) {
        if (prop.type !== 'JSXAttribute') continue
        const propName = getText(prop.name, context)
        if (propName.startsWith('v-') && matches(propName.slice(2))) {
          attributes.splice(attributes.indexOf(prop), 1)
          const onExit = fn(node, prop, context as TransformContext)
          if (onExit) exitFns.push(onExit)
          break
        }
      }
      return exitFns
    }
  }
}
