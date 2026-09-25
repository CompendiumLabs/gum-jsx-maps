// Albers USA supplies the familiar Alaska and Hawaii insets; shared arcs draw interior lines once.
const usStates = us_states()
const regions = {
  '06': '#e76f51', // California
  '48': '#e9c46a', // Texas
  '36': '#2a9d8f', // New York
  '12': '#3a86a6', // Florida
  '53': '#8955a1', // Washington
}

return (
  <Svg width={px(1000)} height={px(680)}>
    <Group width={px(1000)} height={px(680)}>
      <Rect width={px(1000)} height={px(680)} fill="#f8f7f3" stroke="none" />
      <Text x={px(40)} y={px(26)} font-size={px(30)} font-weight="bold" color="#263946">
        US states
      </Text>
      <Text x={px(40)} y={px(67)} font-size={px(15)} color="#67777e">
        Albers USA · state FIPS IDs · interior TopoJSON borders
      </Text>
      <GeoMap
        x={px(35)}
        y={px(102)}
        width={px(930)}
        height={px(500)}
        source={usStates}
        projection="albersUsa"
        fit-to="data"
        map-padding={px(16)}
        fill="#a9c8bd"
        fill-by-id={regions}
        border-mode="interior"
        border-color="#ffffff"
        border-width={px(1.1)}
        aria-label="US states with California, Texas, New York, Florida, and Washington highlighted"
      />
      <Text x={px(40)} y={px(622)} font-size={px(14)} color="#67777e">
        The preset places Alaska and Hawaii as insets; other territories are clipped.
      </Text>
    </Group>
  </Svg>
)
