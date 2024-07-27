import { randMarket } from 'manifold.buni'

type Market = {
  id: string
  name: string
  url: string
}

export default function Toy() {
  const market: Market = randMarket()
  return (
    <div>
      bye
      <h1>{market.name}</h1>
      <p>{market.url}</p>
    </div>
  )
}
