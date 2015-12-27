{join} = require 'path-extra'
{_, $, $$, React, ReactBootstrap, FontAwesome, layout, i18n} = window
{Grid, Row, Col, Tabs, Tab, ListGroup, ListGroupItem, Panel, OverlayTrigger, Tooltip} = ReactBootstrap
# i18n configure
i18n.expedition = new(require 'i18n-2')({
    locales: ['en-US', 'ja-JP', 'zh-CN', 'zh-TW'],
    defaultLocale: 'zh-CN',
    directory: join(__dirname, 'assets', 'i18n'),
    updateFiles: false,
    indent: '\t',
    extension: '.json',
    devMode: false
})
i18n.expedition.setLocale window.language
__ = i18n.expedition.__.bind(i18n.expedition)

itemNames = [
  '',
  __('Repair Buckets'),
  __('Instant Construction'),
  __('Development Materials'),
  __('Furniture Box Small'),
  __('Furniture Box Medium'),
  __('Furniture Box Large')
]

getMaterialImage = (idx) ->
  return join(ROOT, 'assets', 'img', 'material', "0#{idx}.png")

module.exports =
  name: 'expedition'
  priority: 2
  displayName: <span><FontAwesome key={0} name='flag' /> {__('Expedition Information')}</span>
  description: __('Plugin Description')
  author: '马里酱'
  link: 'https://github.com/malichan'
  version: '2.0.1'
  reactClass: React.createClass
    getInitialState: ->
      all_status = []
      fs = require 'fs-extra'
      json = fs.readJsonSync join(__dirname, 'assets', 'expedition.json')
      expeditions = []
      expeditions[expedition.id] = expedition for expedition in json
      {
        expedition_id: 0
        expeditions: expeditions
        expedition_information: []
        expedition_constraints: []
        fleet_status: [false, false, false]
        fleet_reward: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
        fleet_reward_hour: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
        fleet_reward_big: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
        fleet_reward_hour_big: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
      }
    checkFlagshipLv: (deck_id, flagship_lv, decks, ships) ->
      fleet = decks[deck_id]
      return false unless fleet?
      flagship_id = fleet.api_ship[0]
      if flagship_id isnt -1
        _flagship_lv = ships[flagship_id].api_lv
        if _flagship_lv >= flagship_lv
          return true
        else
          return false
      else
        return false
    checkFleetLv: (deck_id, fleet_lv, decks, ships) ->
      fleet = decks[deck_id]
      return false unless fleet?
      _fleet_lv = 0
      for ship_id in fleet.api_ship when ship_id isnt -1
        ship_lv = ships[ship_id].api_lv
        _fleet_lv += ship_lv
      if _fleet_lv >= fleet_lv
        return true
      else
        return false
    checkFlagshipShiptype: (deck_id, flagship_shiptype, decks, ships, Ships) ->
      fleet = decks[deck_id]
      return false unless fleet?
      flagship_id = fleet.api_ship[0]
      if flagship_id isnt -1
        flagship_shipid = ships[flagship_id].api_ship_id
        _flagship_shiptype = Ships[flagship_shipid].api_stype
        if _flagship_shiptype is flagship_shiptype
          return true
        else
          return false
      else
        return false
    checkShipCount: (deck_id, ship_count, decks) ->
      fleet = decks[deck_id]
      return false unless fleet?
      _ship_count = 0
      for ship_id in fleet.api_ship when ship_id isnt -1
        _ship_count += 1
      if _ship_count >= ship_count
        return true
      else
        return false
    checkDrumShipCount: (deck_id, drum_ship_count, decks, ships, slotitems) ->
      fleet = decks[deck_id]
      return false unless fleet?
      _drum_ship_count = 0
      for ship_id in fleet.api_ship when ship_id isnt -1
        for slotitem_id in ships[ship_id].api_slot when slotitem_id isnt -1
          slotitem_slotitemid = slotitems[slotitem_id].api_slotitem_id
          if slotitem_slotitemid is 75
            _drum_ship_count += 1
            break
      if _drum_ship_count >= drum_ship_count
        return true
      else
        return false
    checkDrumCount: (deck_id, drum_count, decks, ships, slotitems) ->
      fleet = decks[deck_id]
      return false unless fleet?
      _drum_count = 0
      for ship_id in fleet.api_ship when ship_id isnt -1
        for slotitem_id in ships[ship_id].api_slot when slotitem_id isnt -1
          slotitem_slotitemid = slotitems[slotitem_id].api_slotitem_id
          if slotitem_slotitemid is 75
            _drum_count += 1
      if _drum_count >= drum_count
        return true
      else
        return false
    checkRequiredShiptype: (deck_id, required_shiptype, decks, ships, Ships) ->
      fleet = decks[deck_id]
      return false unless fleet?
      _required_shiptype_count = 0
      for ship_id in fleet.api_ship when ship_id isnt -1
        ship_shipid = ships[ship_id].api_ship_id
        ship_shiptype = Ships[ship_shipid].api_stype
        if ship_shiptype in required_shiptype.shiptype
          _required_shiptype_count += 1
      if _required_shiptype_count >= required_shiptype.count
        return true
      else
        return false
    checkSupply: (deck_id, decks, ships) ->
      fleet = decks[deck_id]
      return false unless fleet?
      _supply_ok = true
      for ship_id in fleet.api_ship when ship_id isnt -1
        ship_fuel = ships[ship_id].api_fuel
        ship_fuel_max = ships[ship_id].api_fuel_max
        ship_bull = ships[ship_id].api_bull
        ship_bull_max = ships[ship_id].api_bull_max
        if ship_fuel < ship_fuel_max or ship_bull < ship_bull_max
          _supply_ok = false
          break
      return _supply_ok
    checkCondition: (deck_id, decks, ships) ->
      fleet = decks[deck_id]
      return false unless fleet?
      _condition_ok = true
      for ship_id in fleet.api_ship when ship_id isnt -1
        ship_cond = ships[ship_id].api_cond
        if ship_cond < 30
          _condition_ok = false
          break
      return _condition_ok
    checkFlagshipHp: (deck_id, decks, ships) ->
      fleet = decks[deck_id]
      return false unless fleet?
      flagship_id = fleet.api_ship[0]
      if flagship_id isnt -1
        flagship_hp = ships[flagship_id].api_nowhp
        flagship_maxhp = ships[flagship_id].api_maxhp
        if flagship_hp / flagship_maxhp > 0.25
          return true
        else
          return false
      else
        return false
    examineConstraints: (exp_id, deck_id) ->
      {$ships, _decks, _ships, _slotitems} = window
      return false if exp_id is 0
      return false unless $ships? and _decks? and _ships? and _slotitems?
      expedition = @state.expeditions[exp_id]
      status = true
      if expedition?
        if expedition.flagship_lv isnt 0
          status &= @checkFlagshipLv deck_id, expedition.flagship_lv, _decks, _ships
        if expedition.fleet_lv isnt 0
          status &= @checkFleetLv deck_id, expedition.fleet_lv, _decks, _ships
        if expedition.flagship_shiptype isnt 0
          status &= @checkFlagshipShiptype deck_id, expedition.flagship_shiptype, _decks, _ships, $ships
        if expedition.ship_count isnt 0
          status &= @checkShipCount deck_id, expedition.ship_count, _decks
        if expedition.drum_ship_count isnt 0
          status &= @checkDrumShipCount deck_id, expedition.drum_ship_count, _decks, _ships, _slotitems
        if expedition.drum_count isnt 0
          status &= @checkDrumCount deck_id, expedition.drum_count, _decks, _ships, _slotitems
        if expedition.required_shiptypes.length isnt 0
          for required_shiptype in expedition.required_shiptypes
            status &= @checkRequiredShiptype deck_id, required_shiptype, _decks, _ships, $ships
      status &= @checkSupply deck_id, _decks, _ships
      status &= @checkCondition deck_id, _decks, _ships
      status &= @checkFlagshipHp deck_id, _decks, _ships
      return status
    getMaxSupply: (deck_id, decks, ships) ->
      _max_supply = [0, 0]
      fleet = decks[deck_id]
      return _max_supply unless fleet?
      for ship_id in fleet.api_ship when ship_id isnt -1
        ship_fuel_max = ships[ship_id].api_fuel_max
        ship_bull_max = ships[ship_id].api_bull_max
        _max_supply[0] += ship_fuel_max
        _max_supply[1] += ship_bull_max
      return _max_supply
    getDaihatsuBonus: (deck_id, decks, ships, slotitems) ->
      _daihatsu_count = 0
      fleet = decks[deck_id]
      return _daihatsu_count unless fleet?
      for ship_id in fleet.api_ship when ship_id isnt -1
        for slotitem_id in ships[ship_id].api_slot when slotitem_id isnt -1
          slotitem_slotitemid = slotitems[slotitem_id].api_slotitem_id
          if slotitem_slotitemid is 68
            _daihatsu_count += 1
      if _daihatsu_count > 4
        _daihatsu_count = 4
      return 1 + _daihatsu_count * 0.05
    calculateReward: (exp_id, deck_id, deck_status) ->
      reward = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
      {$missions, _decks, _ships, _slotitems} = window
      return reward if exp_id is 0
      return reward unless $missions? and _decks? and _ships? and _slotitems?
      mission = $missions[exp_id]
      expedition = @state.expeditions[exp_id]
      return reward unless mission? and expedition?
      max_supply = @getMaxSupply deck_id, _decks, _ships
      coeff = @getDaihatsuBonus deck_id, _decks, _ships, _slotitems
      coeff = 0 unless deck_status
      actual_reward = [0, 0, 0, 0]
      actual_reward[0] = expedition.reward_fuel * coeff - mission.api_use_fuel * max_supply[0]
      actual_reward[1] = expedition.reward_bullet * coeff - mission.api_use_bull * max_supply[1]
      actual_reward[2] = expedition.reward_steel * coeff
      actual_reward[3] = expedition.reward_alum * coeff
      inv_time = 60 / mission.api_time;
      for i in [0...4]
        reward[0][i] = Math.floor actual_reward[i]
        reward[1][i] = Math.floor reward[0][i] * inv_time
      coeff *= 1.5
      actual_reward[0] = expedition.reward_fuel * coeff - mission.api_use_fuel * max_supply[0]
      actual_reward[1] = expedition.reward_bullet * coeff - mission.api_use_bull * max_supply[1]
      actual_reward[2] = expedition.reward_steel * coeff
      actual_reward[3] = expedition.reward_alum * coeff
      for i in [0...4]
        reward[2][i] = Math.floor actual_reward[i]
        reward[3][i] = Math.floor reward[2][i] * inv_time
      return reward
    describeConstraints: (exp_id) ->
      {$shipTypes, $missions} = window
      return {information: [], constraints: []} if exp_id is 0
      return {information: [], constraints: []} unless $shipTypes? and $missions?
      mission = $missions[exp_id]
      expedition = @state.expeditions[exp_id]
      information = []
      if mission?
        hours = mission.api_time // 60;
        minutes = mission.api_time % 60;
        information.push <li key='time'>{__ 'Time'} {hours}:{if minutes < 10 then "0#{minutes}" else minutes}</li>
        information.push <li key='use_fuel'>{__ 'Consume Fuel'} {mission.api_use_fuel * 100}%</li>
        information.push <li key='use_bull'>{__ 'Consume Ammo'} {mission.api_use_bull * 100}%</li>
        if expedition?
          if expedition.reward_fuel isnt 0
            information.push <li key='reward_fuel'>
                               <OverlayTrigger placement='right' overlay={
                                 <Tooltip id='fuel-per-hour'>
                                   {__ 'Fuel'} {Math.round(expedition.reward_fuel * 60 / mission.api_time)} / {__ 'hour(s)'}
                                 </Tooltip>}>
                                 <div className='tooltipTrigger'>
                                   {__ 'Fuel'} {expedition.reward_fuel}
                                 </div>
                               </OverlayTrigger>
                             </li>
          if expedition.reward_bullet isnt 0
            information.push <li key='reward_bullet'>
                               <OverlayTrigger placement='right' overlay={
                                 <Tooltip id='bull-per-hour'>
                                   {__ 'Ammo'} {Math.round(expedition.reward_bullet * 60 / mission.api_time)} / {__ 'hour(s)'}
                                 </Tooltip>}>
                                 <div className='tooltipTrigger'>
                                   {__ 'Ammo'} {expedition.reward_bullet}
                                 </div>
                               </OverlayTrigger>
                             </li>
          if expedition.reward_steel isnt 0
            information.push <li key='reward_steel'>
                               <OverlayTrigger placement='right' overlay={
                                 <Tooltip id='steel-per-hour'>
                                   {__ 'Steel'} {Math.round(expedition.reward_steel * 60 / mission.api_time)} / {__ 'hour(s)'}
                                 </Tooltip>}>
                                 <div className='tooltipTrigger'>
                                   {__ 'Steel'} {expedition.reward_steel}
                                 </div>
                               </OverlayTrigger>
                             </li>
          if expedition.reward_alum isnt 0
            information.push <li key='reward_alum'>
                               <OverlayTrigger placement='right' overlay={
                                 <Tooltip id='bauxite-per-hour'>
                                   {__ 'Bauxite'} {Math.round(expedition.reward_alum * 60 / mission.api_time)} / {__ 'hour(s)'}
                                 </Tooltip>}>
                                 <div className='tooltipTrigger'>
                                   {__ 'Bauxite'} {expedition.reward_alum}
                                 </div>
                               </OverlayTrigger>
                             </li>
          if expedition.reward_items.length isnt 0
            for reward_item, i in expedition.reward_items
              information.push <li key="reward_items_#{i}">{itemNames[reward_item.itemtype]} 0~{reward_item.max_number}</li>
      constraints = []
      if expedition?
        if expedition.flagship_lv isnt 0
          constraints.push <li key='flagship_lv'>{__ 'Flagship Lv.'} {expedition.flagship_lv}</li>
        if expedition.fleet_lv isnt 0
          constraints.push <li key='fleet_lv'>{__ 'Total Lv.'} {expedition.fleet_lv}</li>
        if expedition.flagship_shiptype isnt 0
          constraints.push <li key='flagship_shiptype'>{__ 'Flagship Type'} {$shipTypes[expedition.flagship_shiptype].api_name}</li>
        if expedition.ship_count isnt 0
          constraints.push <li key='ship_count'>{__ 'Number of ships'} {expedition.ship_count} </li>
        if expedition.drum_ship_count isnt 0
          constraints.push <li key='drum_ship_count'>{__ 'Minimum of %s ships carrying drum', expedition.drum_ship_count}</li>
        if expedition.drum_count isnt 0
          constraints.push <li key='drum_count'>{__ 'number of drum carriers'} {expedition.drum_count}</li>
        if expedition.required_shiptypes.length isnt 0
          for required_shiptype, i in expedition.required_shiptypes
            stype_name = $shipTypes[required_shiptype.shiptype[0]].api_name
            if required_shiptype.shiptype.length > 1
              for stype in required_shiptype.shiptype[1..]
                stype_name = stype_name + __(' or ') + $shipTypes[stype].api_name
            constraints.push <li key="required_shiptypes_#{i}">{i18n.resources.__(stype_name)} {required_shiptype.count} </li>
        if expedition.big_success?
          constraints.push <li key='big_success'>{__ 'Great Success Requirement(s)'}: {expedition.big_success}</li>
      return {information, constraints}
    getAllStatus: ->
      all_status = []
      status = []
      for mission in $missions when mission?
        for i in [1..3]
          status[i - 1] = @examineConstraints mission.api_id, i
        all_status[mission.api_id] = _.clone(status)
      @setState
        all_status: all_status
    handleStatChange: (exp_id) ->
      all_status = []
      status = [false, false, false]
      reward = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
      reward_hour = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
      reward_big = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
      reward_hour_big = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
      for deck_id in [1..3]
        ret_status = @examineConstraints exp_id, deck_id
        status[deck_id - 1] = ret_status
        ret_reward = @calculateReward exp_id, deck_id, ret_status
        reward[deck_id - 1] = ret_reward[0]
        reward_hour[deck_id - 1] = ret_reward[1]
        reward_big[deck_id - 1] = ret_reward[2]
        reward_hour_big[deck_id - 1] = ret_reward[3]
      @getAllStatus()
      @setState
        fleet_status: status
        fleet_reward: reward
        fleet_reward_hour: reward_hour
        fleet_reward_big: reward_big
        fleet_reward_hour_big: reward_hour_big
    handleInfoChange: (exp_id) ->
      {information, constraints} = @describeConstraints exp_id
      @setState
        expedition_information: information
        expedition_constraints: constraints
    handleExpeditionSelect: (exp_id) ->
      @handleStatChange(exp_id)
      @handleInfoChange(exp_id)
      @setState
        expedition_id: exp_id
    handleResponse: (e) ->
      {method, path, body, postBody} = e.detail
      switch path
        when '/kcsapi/api_port/port', '/kcsapi/api_req_hensei/change', '/kcsapi/api_req_kaisou/slotset', '/kcsapi/api_req_hokyu/charge', '/kcsapi/api_get_member/ndock'
          @handleStatChange(@state.expedition_id)
        when '/kcsapi/api_req_mission/start'
          {$missions} = window
          deck_id = postBody.api_deck_id - 1
          exp_id = postBody.api_mission_id
          status = @examineConstraints exp_id, deck_id
          toggleModal __('Attention!'), __("Fleet %s hasn't reach requirements of %s. Please call back your fleet.", deck_id + 1, $missions[exp_id].api_name) unless status
    componentDidMount: ->
      window.addEventListener 'game.response', @handleResponse
    render: ->
      <div>
        <link rel='stylesheet' href={join(__dirname, 'assets', 'expedition.css')} />
        <Grid>
          <Row>
            <Col xs={12}>
              <Tabs defaultActiveKey={1} animation={false} bsStyle='pills' className='areaTabs'>
                {
                  {$mapareas, $missions} = window
                  if $mapareas?
                    for maparea in $mapareas when maparea?
                      map_missions = (mission for mission in $missions when mission? and mission.api_maparea_id is maparea.api_id)
                      if map_missions.length is 0
                        continue
                      <Tab eventKey={maparea.api_id} key={maparea.api_id} title={maparea.api_name}>
                        <table width='100%' className='expItems'>
                          <tbody>
                            <tr>
                              <td>
                                {
                                  for mission in map_missions[0...4]
                                      <ListGroupItem key={mission.api_id}
                                                     className={if mission.api_id is @state.expedition_id then 'active' else '' }
                                                     style ={display: 'flex', flexFlow:'row nowrap', justifyContent:'space-between'}
                                                     onClick={@handleExpeditionSelect.bind this, mission.api_id}>
                                        <span style={marginRight: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 10}>
                                          {mission.api_id} {mission.api_name}
                                        </span>
                                        <span style={flex: 'none', display: 'flex', alignItems: 'center', width:30, justifyContent: 'space-between'}>
                                        {
                                          for i in [0...3]
                                            <span key={i}>
                                              {
                                                if @state.all_status? and @state.all_status[mission.api_id][i]
                                                  <span className='deckIndicator' style={backgroundColor: '#0F0'}/>
                                                else
                                                  <span className='deckIndicator' style={backgroundColor: '#F00'}/>
                                              }
                                            </span>
                                        }
                                        </span>
                                      </ListGroupItem>
                                }
                              </td>
                              <td>
                                {
                                  for mission in map_missions[4...8]
                                      <ListGroupItem key={mission.api_id}
                                                     className={if mission.api_id is @state.expedition_id then 'active' else '' }
                                                     style ={display: 'flex', flexFlow:'row nowrap', justifyContent:'space-between'}
                                                     onClick={@handleExpeditionSelect.bind this, mission.api_id}>
                                        <span style={marginRight: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 10}>
                                          {mission.api_id} {mission.api_name}
                                        </span>
                                        <span style={flex: 'none', display: 'flex', alignItems: 'center', width:30, justifyContent: 'space-between'}>
                                        {
                                          for i in [0...3]
                                            <span key={i}>
                                              {
                                                if @state.all_status? and @state.all_status[mission.api_id][i]
                                                  <span className='deckIndicator' style={backgroundColor: '#0F0'}/>
                                                else
                                                  <span className='deckIndicator' style={backgroundColor: '#F00'}/>
                                              }
                                            </span>
                                        }
                                        </span>
                                      </ListGroupItem>
                                }
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </Tab>
                }
              </Tabs>
            </Col>
          </Row>
          <Row>
            <Col xs={12}>
              <Panel header={__ 'Preparation'} bsStyle='default' className='fleetPanel'>
                <table width='100%'>
                  <tbody>
                    <tr>
                      {
                        for i in [0...3]
                          <td key={i} width='33.3%'>
                            <OverlayTrigger placement='top' overlay={
                                <Tooltip id="fleet-#{i}-resources">
                                  <div>{__ 'theoretical expedition revenue (per hour)'}</div>
                                  <table width='100%' className='materialTable'>
                                    <tbody>
                                      <tr>
                                        <td width='10%'><img src={getMaterialImage 1} className='material-icon' /></td>
                                        <td width='40%'>
                                          <div>{@state.fleet_reward[i][0]} ({@state.fleet_reward_hour[i][0]})</div>
                                          <div className='text-success'>{@state.fleet_reward_big[i][0]} ({@state.fleet_reward_hour_big[i][0]})</div>
                                        </td>
                                        <td width='10%'><img src={getMaterialImage 3} className='material-icon' /></td>
                                        <td width='40%'>
                                          <div>{@state.fleet_reward[i][2]} ({@state.fleet_reward_hour[i][2]})</div>
                                          <div className='text-success'>{@state.fleet_reward_big[i][2]} ({@state.fleet_reward_hour_big[i][2]})</div>
                                        </td>
                                      </tr>
                                      <tr>
                                        <td><img src={getMaterialImage 2} className='material-icon' /></td>
                                        <td>
                                          <div>{@state.fleet_reward[i][1]} ({@state.fleet_reward_hour[i][1]})</div>
                                          <div className='text-success'>{@state.fleet_reward_big[i][1]} ({@state.fleet_reward_hour_big[i][1]})</div>
                                        </td>
                                        <td><img src={getMaterialImage 4} className='material-icon' /></td>
                                        <td>
                                          <div>{@state.fleet_reward[i][3]} ({@state.fleet_reward_hour[i][3]})</div>
                                          <div className='text-success'>{@state.fleet_reward_big[i][3]} ({@state.fleet_reward_hour_big[i][3]})</div>
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </Tooltip>
                              }>
                              <div className='tooltipTrigger'>
                                {__('fleet %s', i + 2)} {if @state.fleet_status[i] then <FontAwesome key={i * 2} name='check' /> else <FontAwesome key={i * 2 + 1} name='close' />}
                              </div>
                            </OverlayTrigger>
                          </td>
                      }
                    </tr>
                  </tbody>
                </table>
              </Panel>
            </Col>
          </Row>
          <Row>
            <Col xs={12}>
              <div className='expInfo'>
                <Panel header={__ 'Reward'} bsStyle='default' className='expAward'>
                  <ul>
                    {@state.expedition_information}
                  </ul>
                </Panel>
                <Panel header={__ 'Note'} bsStyle='default' className='expCond'>
                  <ul>
                    {@state.expedition_constraints}
                  </ul>
                </Panel>
              </div>
            </Col>
          </Row>
        </Grid>
      </div>
