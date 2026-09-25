// Fit to stable IDs, then use the exact same projection to place a custom route.
const world = world_countries()
const prepared = prepare_geo_source(world)
const view = {
  projection: 'equalEarth',
  fit_to: { ids: ['276', '616', '203', '040', '756'] }, // DE, PL, CZ, AT, CH
  map_padding: 25,
}
const projection = create_geo_projection(prepared, view, 850, 480)
const route = [
  ['Berlin', 13.405, 52.52],
  ['Prague', 14.421, 50.088],
  ['Vienna', 16.374, 48.208],
].map(([name, lon, lat]) => ({ name, xy: projection([lon, lat]) }))

return (
  <Svg width={px(1000)} height={px(640)}>
    <Group width={px(1000)} height={px(640)}>
      <Rect width={px(1000)} height={px(640)} fill="#f7f8f4" stroke="none" />
      <Text x={px(40)} y={px(27)} font-size={px(30)} font-weight="bold" color="#233d4d">
        Selected-region fit
      </Text>
      <Text x={px(40)} y={px(68)} font-size={px(15)} color="#637983">
        Fit five country IDs · reuse the projection for a Berlin–Prague–Vienna route
      </Text>
      <Group x={px(75)} y={px(108)} width={px(850)} height={px(480)}>
        <GeoMap
          width={px(850)}
          height={px(480)}
          source={world}
          projection={view.projection}
          fit-to={view.fit_to}
          map-padding={px(view.map_padding)}
          fill="#b7d2c7"
          border-color="#ffffff"
          border-width={px(1.2)}
          aria-label="Central Europe with a three-city route"
        />
        <Polyline
          width={px(850)}
          height={px(480)}
          points={route.map(place => [px(place.xy[0]), px(place.xy[1])])}
          fill="none"
          stroke="#c4523e"
          stroke-width={px(3)}
        />
        {route.map(place => (
          <Circle
            x={px(place.xy[0])}
            y={px(place.xy[1])}
            anchor="center"
            width={px(12)}
            height={px(12)}
            fill="#c4523e"
            stroke="#ffffff"
            stroke-width={px(2)}
          />
        ))}
      </Group>
      <Text x={px(40)} y={px(606)} font-size={px(14)} color="#637983">
        A selected fit is stable even if unrelated countries are later added to the source.
      </Text>
    </Group>
  </Svg>
)
