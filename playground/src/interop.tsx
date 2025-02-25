import { defineComponent, defineVaporComponent, ref } from 'vue'

const VaporComp = defineVaporComponent(
  (props) => {
    return (
      <div>
        Vapor Component:
        {props.model}
      </div>
    )
  },
  { props: ['model'] },
)

const Comp = (props) => <div>Virtual Dom Component:{props.model}</div>

export default defineComponent(() => {
  const model = ref('')
  return () => [
    <input v-model={model.value}></input>,
    <Comp model={model.value}></Comp>,
    <VaporComp model={model.value} />,
  ]
})
