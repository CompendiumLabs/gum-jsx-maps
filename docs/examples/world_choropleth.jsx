// TopoJSON countries, stable numeric IDs, an equal-area projection, and one-pass borders.
const world = world_countries()
const highlights = {
  '840': '#22577a', // United States
  '124': '#38a3a5', // Canada
  '076': '#57cc99', // Brazil
  '356': '#f4a259', // India
  '036': '#e76f51', // Australia
}

return (
  <Svg width={px(1000)} height={px(600)}>
    <Group width={px(1000)} height={px(600)}>
      <Rect width={px(1000)} height={px(600)} fill="#f5f8f6" stroke="none" />
      <Text x={px(40)} y={px(28)} font-size={px(30)} font-weight="bold" color="#17394d">
        World countries
      </Text>
      <Text x={px(40)} y={px(69)} font-size={px(15)} color="#58717e">
        Equal Earth · 110m topology · country ID fills
      </Text>
      <GeoMap
        x={px(30)}
        y={px(109)}
        width={px(940)}
        height={px(430)}
        source={world}
        projection="equalEarth"
        fit-to="sphere"
        map-padding={px(8)}
        fill="#cbdedc"
        fill-by-id={highlights}
        border-color="#f5f8f6"
        border-width={px(0.6)}
        aria-label="World countries with five countries highlighted"
      />
      <Text x={px(40)} y={px(552)} font-size={px(14)} color="#58717e">
        Country colors are keyed by the atlas IDs, independent of feature order.
      </Text>
    </Group>
  </Svg>
)
