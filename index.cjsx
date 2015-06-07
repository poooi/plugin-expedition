{relative, join} = require "path-extra"
{_, $, $$, React, ReactBootstrap, FontAwesome, layout, JSON} = window
{Grid, Row, Col, TabbedArea, TabPane, ListGroup, ListGroupItem, Panel} = ReactBootstrap

window.addEventListener "layout.change", (e) -> null

module.exports =
  name: "expedition"
  priority: 2
  displayName: [<FontAwesome key={0} name='flag' />, " 远征信息"]
  description: "远征信息查询"
  author: "马里酱"
  link: "https://github.com/malichan"
  version: "0.5.0"
  reactClass: React.createClass
    getInitialState: ->
      fs = require "fs-extra"
      json = fs.readJsonSync join(__dirname, "assets", "expedition.json"), "utf8"
      expeditions = []
      expeditions[expedition.id] = expedition for expedition in json
      {
        expedition_id: 0
        expeditions: expeditions
        expedition_information: []
        expedition_constraints: []
        fleet2_ok: true
        fleet3_ok: false
        fleet4_ok: false
      }
    handleResponse: (e) -> null
    componentDidMount: ->
      window.addEventListener "game.response", @handleResponse
    handleExpeditionSelect: (id) ->
      {$shipTypes, $missions} = window
      expedition = @state.expeditions[id]
      constraints = []
      if expedition?
        if expedition.flagship_lv isnt 0
          constraints.push <li key='flagship_lv'>旗舰等级 Lv. {expedition.flagship_lv}</li>
        if expedition.fleet_lv isnt 0
          constraints.push <li key='fleet_lv'>舰队等级合计 Lv. {expedition.fleet_lv}</li>
        if expedition.flagship_shiptype isnt 0
          constraints.push <li key='flagship_shiptype'>旗舰舰种 {$shipTypes[expedition.flagship_shiptype].api_name}</li>
        if expedition.ship_count isnt 0
          constraints.push <li key='ship_count'>总舰数 {expedition.ship_count} 只</li>
        if expedition.drum_ship_count isnt 0
          constraints.push <li key='drum_ship_count'>装备缶的舰数 {expedition.drum_ship_count} 只</li>
        if expedition.drum_count isnt 0
          constraints.push <li key='drum_count'>装备的缶个数 {expedition.drum_count} 个</li>
        if expedition.required_shiptypes.length isnt 0
          for required_shiptype, i in expedition.required_shiptypes
            stype_name = $shipTypes[required_shiptype.shiptype[0]].api_name
            if required_shiptype.shiptype.length > 1
              for stype in required_shiptype.shiptype[1..]
                stype_name = stype_name + " 或 " + $shipTypes[stype].api_name
            constraints.push <li key="required_shiptypes_#{i}">{stype_name} {required_shiptype.count} 只</li>
      mission = $missions[id]
      information = []
      if mission?
        information.push <li key='time'>远征时间 {mission.api_time} 分钟</li>
        information.push <li key='use_fuel'>消费燃料 {mission.api_use_fuel * 100} %</li>
        information.push <li key='use_bull'>消费弹药 {mission.api_use_bull * 100} %</li>
      @setState
        expedition_id: id
        expedition_constraints: constraints
        expedition_information: information
    render: ->
      <div>
        <link rel='stylesheet' href={join(__dirname, "assets", "expedition.css")} />
        <Grid>
          <Row>
            <Col xs=12>
              <TabbedArea defaultActiveKey={1} animation={false} className='areaTabs'>
                {
                  {$mapareas, $missions} = window
                  if $mapareas?
                    for maparea in $mapareas when maparea?
                      map_missions = (mission for mission in $missions when mission? and mission.api_maparea_id is maparea.api_id)
                      if map_missions.length is 0
                        continue
                      <TabPane eventKey={maparea.api_id} key={maparea.api_id} tab={maparea.api_name}>
                        <table width='100%' className='expItems'>
                          <tbody>
                            <tr>
                              <td>
                                {
                                  for mission in map_missions[0...4]
                                    <ListGroupItem key={mission.api_id} onClick={@handleExpeditionSelect.bind this, mission.api_id}>{mission.api_id} {mission.api_name}</ListGroupItem>
                                }
                              </td>
                              <td>
                                {
                                  for mission in map_missions[4..]
                                    <ListGroupItem key={mission.api_id} onClick={@handleExpeditionSelect.bind this, mission.api_id}>{mission.api_id} {mission.api_name}</ListGroupItem>
                                }
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </TabPane>
                }
              </TabbedArea>
            </Col>
          </Row>
          <Row>
            <Col xs=12>
              <Panel header='舰队准备情况(尚未实现)' className='fleetPanel'>
                <table width='100%'>
                  <tbody>
                    <tr>
                      <td width='33%'>第2舰队 {if @state.fleet2_ok then <FontAwesome key='status_2' name='check' /> else <FontAwesome key='status_2' name='close' />}</td>
                      <td width='33%'>第3舰队 {if @state.fleet3_ok then <FontAwesome key='status_3' name='check' /> else <FontAwesome key='status_3' name='close' />}</td>
                      <td width='34%'>第4舰队 {if @state.fleet4_ok then <FontAwesome key='status_4' name='check' /> else <FontAwesome key='status_4' name='close' />}</td>
                    </tr>
                  </tbody>
                </table>
              </Panel>
            </Col>
          </Row>
          <Row>
            <Col xs=12>
              <table width='100%' className='expInfo'>
                <tbody>
                  <tr>
                    <td>
                      <Panel header='远征收支'>
                        <ul>
                          {@state.expedition_information}
                        </ul>
                      </Panel>
                    </td>
                    <td>
                      <Panel header='必要条件'>
                        <ul>
                          {@state.expedition_constraints}
                        </ul>
                      </Panel>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Col>
          </Row>
        </Grid>
      </div>
