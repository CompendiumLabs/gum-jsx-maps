// A fixed data source and map size make projection differences easy to compare.
const world = world_countries()
const cards = [
  { name: 'Equal Earth', projection: 'equalEarth', x: 34, y: 101 },
  { name: 'Natural Earth', projection: 'naturalEarth1', x: 596, y: 101 },
  { name: 'Equirectangular', projection: 'equirectangular', x: 34, y: 433 },
  { name: 'Mercator', projection: 'mercator', x: 596, y: 433 },
]

return (
  <Svg width={px(1160)} height={px(770)}>
    <Group width={px(1160)} height={px(770)}>
      <Rect width={px(1160)} height={px(770)} fill="#f4f7fa" stroke="none" />
      <Text x={px(34)} y={px(23)} font-size={px(30)} font-weight="bold" color="#1b3548">
        Projection gallery
      </Text>
      <Text x={px(34)} y={px(63)} font-size={px(15)} color="#5b7180">
        One source · one viewport · four projection presets
      </Text>
      {cards.map(card => (
        <Group x={px(card.x)} y={px(card.y)} width={px(530)} height={px(300)}>
          <Rect width={px(530)} height={px(300)} fill="#ffffff" stroke="#d9e2e8" />
          <Text x={px(18)} y={px(13)} font-size={px(19)} font-weight="bold" color="#25465a">
            {card.name}
          </Text>
          <GeoMap
            x={px(12)}
            y={px(48)}
            width={px(506)}
            height={px(238)}
            source={world}
            projection={card.projection}
            fit-to="sphere"
            map-padding={px(4)}
            fill="#5c9ead"
            border-color="#ffffff"
            border-width={px(0.4)}
            aria-label={card.name + ' world map'}
          />
        </Group>
      ))}
    </Group>
  </Svg>
)
