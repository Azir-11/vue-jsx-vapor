import { ref } from 'vue'

const Comp = (props: { foo: string }, { slots }) => {
  return (
    <>
      {slots.default ? (
        <slots.default foo={props.foo} />
      ) : (
        <div>default slot</div>
      )}
    </>
  )
}

const slots = {
  default: (scope) => <div>{scope.foo}</div>,
}

// eslint-disable-next-line unused-imports/no-unused-vars
const slotName = ref('default')
export default () => {
  const foo = ref('foo')
  return (
    <>
      <input v-model={foo.value} />
      <div style="display: flex;">
        <fieldset>
          <legend>v-slots</legend>
          <Comp foo={foo.value} v-slots={slots} />

          <Comp
            foo={foo.value}
            v-slots={{ default: (scope) => <div>{scope.foo}</div> }}
          />
        </fieldset>

        <fieldset>
          <legend>v-slot</legend>
          <Comp foo={foo.value} v-slot:$slotName_value$={scope}>
            <div>{scope.foo}</div>
          </Comp>
        </fieldset>
      </div>
    </>
  )
}
