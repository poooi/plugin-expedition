{relative, join} = require "path-extra"
{_, $, $$, React, ReactBootstrap, FontAwesome, layout, JSON} = window
{Grid, Row, Col, TabbedArea, TabPane, ListGroup, ListGroupItem, Panel} = ReactBootstrap

# window.addEventListener "layout.change", (e) -> null

module.exports =
  name: "expedition"
  priority: 2
  displayName: [<FontAwesome key={0} name='flag' />, " 远征信息"]
  description: "远征信息查询"
  author: "马里酱"
  link: "https://github.com/malichan"
  version: "1.0.0"
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
        fleet_status: [true, false, false]
      }
    checkFlagshipLv: (status, flagship_lv, decks, ships) ->
      for fleet, idx in decks[1..3]
        flagship_id = fleet.api_ship[0]
        if flagship_id isnt -1
          flagship_idx = flagship_id
          _flagship_lv = ships[flagship_idx].api_lv
          if _flagship_lv >= flagship_lv
            status[idx] &= true
          else
            status[idx] &= false
        else
          status[idx] &= false
    checkFleetLv: (status, fleet_lv, decks, ships) ->
      for fleet, idx in decks[1..3]
        _fleet_lv = 0
        for ship_id in fleet.api_ship when ship_id isnt -1
          ship_idx = ship_id
          ship_lv = ships[ship_idx].api_lv
          _fleet_lv += ship_lv
        if _fleet_lv >= fleet_lv
          status[idx] &= true
        else
          status[idx] &= false
    checkFlagshipShiptype: (status, flagship_shiptype, decks, ships, Ships) ->
      for fleet, idx in decks[1..3]
        flagship_id = fleet.api_ship[0]
        if flagship_id isnt -1
          flagship_idx = flagship_id
          flagship_shipid = ships[flagship_idx].api_ship_id
          _flagship_shiptype = Ships[flagship_shipid].api_stype
          if _flagship_shiptype is flagship_shiptype
            status[idx] &= true
          else
            status[idx] &= false
        else
          status[idx] &= false
    checkShipCount: (status, ship_count, decks) ->
      for fleet, idx in decks[1..3]
        _ship_count = 0
        for ship_id in fleet.api_ship when ship_id isnt -1
          _ship_count += 1
        if _ship_count >= ship_count
          status[idx] &= true
        else
          status[idx] &= false
    checkDrumShipCount: (status, drum_ship_count, decks, ships, slotitems) ->
      for fleet, idx in decks[1..3]
        _drum_ship_count = 0
        for ship_id in fleet.api_ship when ship_id isnt -1
          ship_idx = ship_id
          for slotitem_id in ships[ship_idx].api_slot when slotitem_id isnt -1
            slotitem_idx = slotitem_id
            slotitem_slotitemid = slotitems[slotitem_idx].api_slotitem_id
            if slotitem_slotitemid is 75
              _drum_ship_count += 1
              break
        if _drum_ship_count >= drum_ship_count
          status[idx] &= true
        else
          status[idx] &= false
    checkDrumCount: (status, drum_count, decks, ships, slotitems) ->
      for fleet, idx in decks[1..3]
        _drum_count = 0
        for ship_id in fleet.api_ship when ship_id isnt -1
          ship_idx = ship_id
          for slotitem_id in ships[ship_idx].api_slot when slotitem_id isnt -1
            slotitem_idx = slotitem_id
            slotitem_slotitemid = slotitems[slotitem_idx].api_slotitem_id
            if slotitem_slotitemid is 75
              _drum_count += 1
        if _drum_count >= drum_count
          status[idx] &= true
        else
          status[idx] &= false
    checkRequiredShiptype: (status, required_shiptype, decks, ships, Ships) ->
      for fleet, idx in decks[1..3]
        _required_shiptype_count = 0
        for ship_id in fleet.api_ship when ship_id isnt -1
          ship_idx = ship_id
          ship_shipid = ships[ship_idx].api_ship_id
          ship_shiptype = Ships[ship_shipid].api_stype
          if ship_shiptype in required_shiptype.shiptype
            _required_shiptype_count += 1
        if _required_shiptype_count >= required_shiptype.count
          status[idx] &= true
        else
          status[idx] &= false
    handleExpeditionSelect: (id) ->
      {$ships, $shipTypes, $missions, _decks, _ships, _slotitems} = window
      mission = $missions[id]
      expedition = @state.expeditions[id]
      information = []
      if mission?
        hours = mission.api_time // 60;
        minutes = mission.api_time % 60;
        information.push <li key='time'>远征时间 {hours}:{if minutes < 10 then "0#{minutes}" else minutes}</li>
        information.push <li key='use_fuel'>消费燃料 {mission.api_use_fuel * 100}%</li>
        information.push <li key='use_bull'>消费弹药 {mission.api_use_bull * 100}%</li>
        if expedition?
          if expedition.reward_fuel isnt 0
            information.push <li key='reward_fuel'>获得燃料 {expedition.reward_fuel} ({Math.round(expedition.reward_fuel * 60 / mission.api_time)}/时)</li>
          if expedition.reward_bullet isnt 0
            information.push <li key='reward_bullet'>获得弹药 {expedition.reward_bullet} ({Math.round(expedition.reward_bullet * 60 / mission.api_time)}/时)</li>
          if expedition.reward_steel isnt 0
            information.push <li key='reward_steel'>获得钢材 {expedition.reward_steel} ({Math.round(expedition.reward_steel * 60 / mission.api_time)}/时)</li>
          if expedition.reward_alum isnt 0
            information.push <li key='reward_alum'>获得铝土 {expedition.reward_alum} ({Math.round(expedition.reward_alum * 60 / mission.api_time)}/时)</li>
      constraints = []
      status = [true, true, true]
      if expedition?
        if expedition.flagship_lv isnt 0
          constraints.push <li key='flagship_lv'>旗舰等级 Lv. {expedition.flagship_lv}</li>
          @checkFlagshipLv status, expedition.flagship_lv, _decks, _ships
        if expedition.fleet_lv isnt 0
          constraints.push <li key='fleet_lv'>舰队等级合计 Lv. {expedition.fleet_lv}</li>
          @checkFleetLv status, expedition.fleet_lv, _decks, _ships
        if expedition.flagship_shiptype isnt 0
          constraints.push <li key='flagship_shiptype'>旗舰舰种 {$shipTypes[expedition.flagship_shiptype].api_name}</li>
          @checkFlagshipShiptype status, expedition.flagship_shiptype, _decks, _ships, $ships
        if expedition.ship_count isnt 0
          constraints.push <li key='ship_count'>总舰数 {expedition.ship_count} 只</li>
          @checkShipCount status, expedition.ship_count, _decks
        if expedition.drum_ship_count isnt 0
          constraints.push <li key='drum_ship_count'>装备缶的舰数 {expedition.drum_ship_count} 只</li>
          @checkDrumShipCount status, expedition.drum_ship_count, _decks, _ships, _slotitems
        if expedition.drum_count isnt 0
          constraints.push <li key='drum_count'>装备的缶个数 {expedition.drum_count} 个</li>
          @checkDrumCount status, expedition.drum_count, _decks, _ships, _slotitems
        if expedition.required_shiptypes.length isnt 0
          for required_shiptype, i in expedition.required_shiptypes
            stype_name = $shipTypes[required_shiptype.shiptype[0]].api_name
            if required_shiptype.shiptype.length > 1
              for stype in required_shiptype.shiptype[1..]
                stype_name = stype_name + " 或 " + $shipTypes[stype].api_name
            constraints.push <li key="required_shiptypes_#{i}">{stype_name} {required_shiptype.count} 只</li>
            @checkRequiredShiptype status, required_shiptype, _decks, _ships, $ships
      @setState
        expedition_id: id
        expedition_constraints: constraints
        expedition_information: information
        fleet_status: status
    handleResponse: (e) ->
      @handleExpeditionSelect(@state.expedition_id)
    componentDidMount: ->
      window.addEventListener "game.response", @handleResponse
    render: ->
      <div>
        <link rel='stylesheet' href={join(__dirname, "assets", "expedition.css")} />
        <Grid>
          <Row>
            <Col xs=12>
              <TabbedArea defaultActiveKey={1} animation={false} bsStyle='pills' className='areaTabs'>
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
              <Panel header='舰队准备情况' bsStyle='danger' className='fleetPanel'>
                <table width='100%'>
                  <tbody>
                    <tr>
                      <td width='33%'>第2艦隊 {if @state.fleet_status[0] then <FontAwesome key='status_2_yes' name='check' /> else <FontAwesome key='status_2_no' name='close' />}</td>
                      <td width='33%'>第3艦隊 {if @state.fleet_status[1] then <FontAwesome key='status_3_yes' name='check' /> else <FontAwesome key='status_3_no' name='close' />}</td>
                      <td width='34%'>第4艦隊 {if @state.fleet_status[2] then <FontAwesome key='status_4_yes' name='check' /> else <FontAwesome key='status_4_no' name='close' />}</td>
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
                      <Panel header='远征收支' bsStyle='info'>
                        <ul>
                          {@state.expedition_information}
                        </ul>
                      </Panel>
                    </td>
                    <td>
                      <Panel header='必要条件' bsStyle='success'>
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
