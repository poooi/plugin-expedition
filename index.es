import { join } from 'path-extra'
import React, { Component } from 'react'
import { connect } from 'react-redux'
import { readJsonSync } from 'fs-extra'
import { Grid, Row, Col, Tabs, Tab, ListGroupItem, Panel, OverlayTrigger, Tooltip } from 'react-bootstrap'
import { keyBy, sum, join as joinString, range } from 'lodash'

const { FontAwesome, i18n, ROOT } = window

const __ = i18n["poi-plugin-expedition"].__.bind(i18n["poi-plugin-expedition"])

const expeditionData = readJsonSync(join(__dirname, 'assets', 'expedition.json'))

const itemNames = [
  '',
  __('Repair Buckets'),
  __('Instant Construction'),
  __('Development Materials'),
  __('Furniture Box Small'),
  __('Furniture Box Medium'),
  __('Furniture Box Large'),
]

function getMaterialImage(idx) {
  return join(ROOT, 'assets', 'img', 'material', `0${idx}.png`)
}

export const reactClass = connect(
  (state) => ({
  }),
  null, null, {pure: false}
)(class PoiPluginExpedition extends Component {
  constructor(props) {
    super(props)
    this.state = {
      expedition_id: 0,
      expeditions: keyBy(expeditionData, 'id'),
      expedition_information: [],
      expedition_constraints: [],
      fleet_status: [false, false, false],
      fleet_reward: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
      fleet_reward_hour: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
      fleet_reward_big: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
      fleet_reward_hour_big: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    }
  }
  checkFlagshipLv = (deck_id, flagship_lv, decks, ships) => {
    const fleet = decks[deck_id]
    if (!fleet)
      return false
    const flagship_id = fleet.api_ship[0]
    if (flagship_id != -1) {
      const _flagship_lv = ships[flagship_id].api_lv
      if (_flagship_lv >= flagship_lv)
        return true
      else
        return false
    } else {
      return false
    }
  }
  checkFleetLv = (deck_id, fleet_lv, decks, ships) => {
    const fleet = decks[deck_id]
    if (!fleet)
      return false
    const _fleet_lv = sum(fleet.api_ship.map((shipId) =>
      shipId == -1 ? 0 : ships[shipId].api_lv))
    if (_fleet_lv >= fleet_lv)
      return true
    else
      return false
  }
  checkFlagshipShiptype = (deck_id, flagship_shiptype, decks, ships, Ships) => {
    const fleet = decks[deck_id]
    if (!fleet)
      return false
    const flagship_id = fleet.api_ship[0]
    if (flagship_id != -1) {
      const flagship_shipid = ships[flagship_id].api_ship_id
      const _flagship_shiptype = Ships[flagship_shipid].api_stype
      if (_flagship_shiptype == flagship_shiptype)
        return true
      else
        return false
    } else {
      return false
    }
  }
  checkShipCount = (deck_id, ship_count, decks) => {
    const fleet = decks[deck_id]
    if (!fleet)
      return false
    const _ship_count = fleet.api_ship.filter((n) => n != -1).length
    if (_ship_count >= ship_count)
      return true
    else
      return false
  }
  checkDrumAndShipCount = (deck_id, decks, ships, slotitems) => {
    const fleet = decks[deck_id]
    if (!fleet)
      return false
    const _drum_each_ship = [0, 0]
    let _drum_count = 0
    fleet.api_ship.forEach((shipId) => {
      if (shipId == -1)
        return
      const _count = ships[shipId].api_slot.filter((slotitem_id) => 
        (slotitem_id != -1) &&
        (slotitems[slotitem_id].api_slotitem_id == 75)
      ).length
      if (_count >= 1) {
        _drum_each_ship[0] += 1
        if (_count >= 2)
          _drum_each_ship[1] += 1
      }
      _drum_count += _count
    })
    if (_drum_count < 8) {
      return false
    } else {
      if (_drum_each_ship[1] >= 4)
        return true
      else if (_drum_each_ship[1] >= 2 && _drum_each_ship[0] == 6)
        return true
      else
        return false
    }
  }
  checkDrumShipCount = (deck_id, drum_ship_count, decks, ships, slotitems) => {
    const fleet = decks[deck_id]
    if (!fleet)
      return false
    const _drum_ship_count = fleet.api_ship.filter((ship_id) =>
      ship_id != -1 &&
      ships[ship_id].api_slot.find((slotitem_id) => 
        slotitem_id != -1 && slotitems[slotitem_id].api_slotitem_id == 75
      ) != null
    ).length
    if (_drum_ship_count >= drum_ship_count)
      return true
    else
      return false
  }
  checkDrumCount = (deck_id, drum_count, decks, ships, slotitems) => {
    const fleet = decks[deck_id]
    if (!fleet)
      return false
    const _drum_count = sum(fleet.api_ship.map((ship_id) =>
      ship_id == -1 ? 0 : 
      ships[ship_id].api_slot.filter((slotitem_id) =>
        slotitem_id != -1 && 
        slotitems[slotitem_id].api_slotitem_id == 75
      ).length
    ))
    if (_drum_count >= drum_count)
      return true
    else
      return false
  }
  checkRequiredShiptype = (deck_id, required_shiptype, decks, ships, Ships) => {
    const fleet = decks[deck_id]
    if (!fleet)
      return false
    const _required_shiptype_count = fleet.api_ship.filter((ship_id) =>
      ship_id != -1 &&
      required_shiptype.shiptype.includes(Ships[ships[ship_id].api_ship_id].api_stype)
    ).length
    if (_required_shiptype_count >= required_shiptype.count)
      return true
    else
      return false
  }
  checkSupply = (deck_id, decks, ships) => {
    const fleet = decks[deck_id]
    if (!fleet)
      return false
    return fleet.api_ship.every((ship_id) => {
      if (ship_id == -1) {
        return true
      }
      const ship = ships[ship_id]
      return ship.api_fuel >= ship.api_fuel_max && 
        ship.api_bull >= ship.api_bull_max
    })
  }
  checkFlagshipHp = (deck_id, decks, ships) => {
    const fleet = decks[deck_id]
    if (!fleet)
      return false
    const flagship_id = fleet.api_ship[0]
    if (flagship_id != -1) {
      const flagship_hp = ships[flagship_id].api_nowhp
      const flagship_maxhp = ships[flagship_id].api_maxhp
      if (flagship_hp / flagship_maxhp > 0.25)
        return true
      else
        return false
    } else {
      return false
    }
  }
  examineConstraints = (exp_id, deck_id) => {
    const {$ships, _decks, _ships, _slotitems} = window
    if (exp_id == 0)
      return false 
    if ($ships == null || _decks == null || _ships == null || _slotitems == null)
      return false
    const expedition = this.state.expeditions[exp_id]
    let status = true
    if (expedition) {
      if (expedition.flagship_lv != 0)
        status &= this.checkFlagshipLv(deck_id, expedition.flagship_lv, _decks, _ships)
      if (expedition.fleet_lv != 0)
        status &= this.checkFleetLv(deck_id, expedition.fleet_lv, _decks, _ships)
      if (expedition.flagship_shiptype != 0)
        status &= this.checkFlagshipShiptype(deck_id, expedition.flagship_shiptype, _decks, _ships, $ships)
      if (expedition.ship_count != 0)
        status &= this.checkShipCount(deck_id, expedition.ship_count, _decks)
      if (exp_id == 38) {
        status &= this.checkDrumAndShipCount(deck_id, _decks, _ships, _slotitems)
      } else {
        if (expedition.drum_ship_count != 0)
          status &= this.checkDrumShipCount(deck_id, expedition.drum_ship_count, _decks, _ships, _slotitems)
        if (expedition.drum_count != 0)
          status &= this.checkDrumCount(deck_id, expedition.drum_count, _decks, _ships, _slotitems)
      }
      if (expedition.required_shiptypes.length != 0)
        expedition.required_shiptypes.forEach((required_shiptype) => {
          status &= this.checkRequiredShiptype(deck_id, required_shiptype, _decks, _ships, $ships)
        })
    }
    status &= this.checkSupply(deck_id, _decks, _ships)
    status &= this.checkFlagshipHp(deck_id, _decks, _ships)
    return status
  }
  getMaxSupply = (deck_id, decks, ships) => {
    const _max_supply = [0, 0]
    const fleet = decks[deck_id]
    if (!fleet)
      return _max_supply
    fleet.api_ship.forEach((ship_id) => {
      if (ship_id == -1)
        return
      _max_supply[0] += ships[ship_id].api_fuel_max
      _max_supply[1] += ships[ship_id].api_bull_max
    })
    return _max_supply
  }
  getDaihatsuBonus = (deck_id, decks, ships, slotitems) => {
    const fleet = decks[deck_id]
    if (!fleet)
      return 0
    const _daihatsu_count = sum(fleet.api_ship.map((ship_id) =>
      ship_id == -1 ? 0 :
      ships[ship_id].api_slot.filter((slotitem_id) =>
        slotitem_id != -1 &&
        slotitems[slotitem_id].api_slotitem_id == 68
      ).length
    ))
    return 1 + Math.min(_daihatsu_count, 4) * 0.05
  }
  calculateReward = (exp_id, deck_id, deck_status) => {
    const reward = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
    const {$ships, $missions, _decks, _ships, _slotitems} = window
    if (exp_id == 0)
      return reward 
    if ($ships == null || _decks == null || _ships == null || _slotitems == null)
      return reward
    const mission = $missions[exp_id]
    const expedition = this.state.expeditions[exp_id]
    if (!mission || !expedition)
      return reward
    const max_supply = this.getMaxSupply(deck_id, _decks, _ships)
    let coeff = this.getDaihatsuBonus(deck_id, _decks, _ships, _slotitems)
    if (!deck_status)
      coeff = 0
    const actual_reward = [0, 0, 0, 0]
    actual_reward[0] = expedition.reward_fuel * coeff - mission.api_use_fuel * max_supply[0]
    actual_reward[1] = expedition.reward_bullet * coeff - mission.api_use_bull * max_supply[1]
    actual_reward[2] = expedition.reward_steel * coeff
    actual_reward[3] = expedition.reward_alum * coeff
    const inv_time = 60 / mission.api_time
    for (let i = 0; i < 4; i++) {
      reward[0][i] = Math.floor(actual_reward[i])
      reward[1][i] = Math.floor(reward[0][i] * inv_time)
    }
    coeff *= 1.5
    actual_reward[0] = expedition.reward_fuel * coeff - mission.api_use_fuel * max_supply[0]
    actual_reward[1] = expedition.reward_bullet * coeff - mission.api_use_bull * max_supply[1]
    actual_reward[2] = expedition.reward_steel * coeff
    actual_reward[3] = expedition.reward_alum * coeff
    for (let i = 0; i < 4; i++) {
      reward[2][i] = Math.floor(actual_reward[i])
      reward[3][i] = Math.floor(reward[2][i] * inv_time)
    }
    return reward
  }
  describeConstraints = (exp_id) => {
    const {$shipTypes, $missions} = window
    if (exp_id == 0)
      return {information: [], constraints: []} 
    if (!$shipTypes || !$missions)
      return {information: [], constraints: []}
    const mission = $missions[exp_id]
    const expedition = this.state.expeditions[exp_id]
    const information = []
    if (mission) {
      const hours = Math.ceil(mission.api_time / 60)
      const minutes = mission.api_time % 60
      information.push(<li key='time'>{__('Time')} {hours}:{minutes < 10 ? `0${minutes}` : minutes}</li>)
      information.push(<li key='use_fuel'>{__('Consume Fuel')} {mission.api_use_fuel * 100}%</li>)
      information.push(<li key='use_bull'>{__('Consume Ammo')} {mission.api_use_bull * 100}%</li>)
      if (expedition) {
        if (expedition.reward_fuel != 0)
          information.push(
            <li key='reward_fuel'>
              <OverlayTrigger placement='right' overlay={
                <Tooltip id='fuel-per-hour'>
                  {__('Fuel')} {Math.round(expedition.reward_fuel * 60 / mission.api_time)} / {__('hour(s)')}
                </Tooltip>}>
                <div className='tooltipTrigger'>
                  {__('Fuel')} {expedition.reward_fuel}
                </div>
              </OverlayTrigger>
            </li>
          )
        if (expedition.reward_bullet != 0)
          information.push(
            <li key='reward_bullet'>
              <OverlayTrigger placement='right' overlay={
                <Tooltip id='bull-per-hour'>
                  {__('Ammo')} {Math.round(expedition.reward_bullet * 60 / mission.api_time)} / {__('hour(s)')}
                </Tooltip>}>
                <div className='tooltipTrigger'>
                  {__('Ammo')} {expedition.reward_bullet}
                </div>
              </OverlayTrigger>
            </li>
          )
        if (expedition.reward_steel != 0)
          information.push(
            <li key='reward_steel'>
              <OverlayTrigger placement='right' overlay={
                <Tooltip id='steel-per-hour'>
                  {__('Steel')} {Math.round(expedition.reward_steel * 60 / mission.api_time)} / {__('hour(s)')}
                </Tooltip>}>
                <div className='tooltipTrigger'>
                  {__('Steel')} {expedition.reward_steel}
                </div>
              </OverlayTrigger>
            </li>
          )
        if (expedition.reward_alum != 0)
          information.push(
            <li key='reward_alum'>
              <OverlayTrigger placement='right' overlay={
                <Tooltip id='bauxite-per-hour'>
                  {__('Bauxite')} {Math.round(expedition.reward_alum * 60 / mission.api_time)} / {__('hour(s)')}
                </Tooltip>}>
                <div className='tooltipTrigger'>
                  {__('Bauxite')} {expedition.reward_alum}
                </div>
              </OverlayTrigger>
            </li>
          )
        if (expedition.reward_items.length != 0)
          expedition.reward_items.forEach((reward_item, i) => {
            information.push(<li key={`reward_items_${i}`}>{itemNames[reward_item.itemtype]} 0~{reward_item.max_number}</li>)
          })
      }
    }
    const constraints = []
    if (expedition) {
      if (expedition.flagship_lv != 0)
        constraints.push(<li key='flagship_lv'>{__('Flagship Lv.')} {expedition.flagship_lv}</li>)
      if (expedition.fleet_lv != 0)
        constraints.push(<li key='fleet_lv'>{__('Total Lv.')} {expedition.fleet_lv}</li>)
      if (expedition.flagship_shiptype != 0)
        constraints.push(<li key='flagship_shiptype'>{__('Flagship Type')} {$shipTypes[expedition.flagship_shiptype].api_name}</li>)
      if (expedition.ship_count != 0)
        constraints.push(<li key='ship_count'>{__('Number of ships')} {expedition.ship_count} </li>)
      if (expedition.drum_ship_count != 0)
        constraints.push(<li key='drum_ship_count'>{__('Minimum of %s ships carrying drum', expedition.drum_ship_count)}</li>)
      if (expedition.drum_count != 0)
        constraints.push(<li key='drum_count'>{__('number of drum carriers')} {expedition.drum_count}</li>)
      if (expedition.required_shiptypes.length != 0)
        expedition.required_shiptypes.forEach((required_shiptype, i) => {
          const stype_name = joinString(required_shiptype.shiptype.map((ship_type) => $shipTypes[ship_type].api_name), __(' or '))
          constraints.push(<li key={`required_shiptypes_${i}`}>{i18n.resources.__(stype_name)} {required_shiptype.count} </li>)
        })
      if (expedition.big_success)
        constraints.push(<li key='big_success'>{__('Great Success Requirement(s)')}: {expedition.big_success}</li>)
    }
    return {information, constraints}
  }
  getAllStatus = () => {
    const all_status = []
    window.$missions.forEach((mission) => {
      if (!mission)
        return
      const status = []
      for (let i = 1; i < 4; i++) {
        status[i - 1] = this.examineConstraints(mission.api_id, i)
      }
      all_status[mission.api_id] = status
    })
    this.setState({
      all_status: all_status,
    })
  }
  handleStatChange = (exp_id) => {
    const status = [false, false, false]
    const reward = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
    const reward_hour = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
    const reward_big = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
    const reward_hour_big = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
    for (let deck_id = 1; deck_id < 4; deck_id++) {
      const ret_status = this.examineConstraints(exp_id, deck_id)
      status[deck_id - 1] = ret_status
      const ret_reward = this.calculateReward(exp_id, deck_id, ret_status)
      reward[deck_id - 1] = ret_reward[0]
      reward_hour[deck_id - 1] = ret_reward[1]
      reward_big[deck_id - 1] = ret_reward[2]
      reward_hour_big[deck_id - 1] = ret_reward[3]
    }
    this.getAllStatus()
    this.setState({
      fleet_status: status,
      fleet_reward: reward,
      fleet_reward_hour: reward_hour,
      fleet_reward_big: reward_big,
      fleet_reward_hour_big: reward_hour_big,
    })
  }
  handleInfoChange = (exp_id) => {
    const {information, constraints} = this.describeConstraints(exp_id)
    this.setState({
      expedition_information: information,
      expedition_constraints: constraints,
    })
  }
  handleExpeditionSelect = (exp_id) => {
    this.handleStatChange(exp_id)
    this.handleInfoChange(exp_id)
    this.setState({
      expedition_id: exp_id,
    })
  }
  handleResponse = (e) => {
    const {path, postBody} = e.detail
    switch (path) {
    case '/kcsapi/api_port/port':
    case '/kcsapi/api_req_hensei/change':
    case '/kcsapi/api_req_kaisou/slotset':
    case '/kcsapi/api_req_hokyu/charge':
    case '/kcsapi/api_get_member/ndock':
      this.handleStatChange(this.state.expedition_id)
      break
    case '/kcsapi/api_req_mission/start': {
      const {$missions} = window
      const deck_id = postBody.api_deck_id - 1
      const exp_id = postBody.api_mission_id
      const status = this.examineConstraints(exp_id, deck_id)
      if (!status)
        window.toggleModal(__('Attention!'), __("Fleet %s hasn't reach requirements of %s. Please call back your fleet.", deck_id + 1, $missions[exp_id].api_name))
      break
    }
    }
  }
  componentDidMount() {
    window.addEventListener('game.response', this.handleResponse)
  }
  componentWillUnmount() {
    window.removeEventListener('game.response', this.handleResponse)
  }
  render() {
    return (
      <div id="expedition" className="expedition">
        <link rel='stylesheet' href={join(__dirname, 'assets', 'expedition.css')} />
        <Grid>
          <Row>
            <Col xs={12}>
              <Tabs defaultActiveKey={1} animation={false} bsStyle='pills' className='areaTabs' id='areaTabs'>
                {
                  !window.$mapareas ? undefined : (
                    window.$mapareas.filter(Boolean).map((maparea) => {
                      const map_missions = window.$missions.filter((mission) => mission && mission.api_maparea_id == maparea.api_id)
                      if (map_missions.length == 0)
                        return
                      const missionDisplays = map_missions.map((mission) =>
                        <ListGroupItem key={mission.api_id}
                                       className={mission.api_id == this.state.expedition_id ? 'active' : '' }
                                       style={{display: 'flex', flexFlow:'row nowrap', justifyContent:'space-between'}}
                                       onClick={this.handleExpeditionSelect.bind(this, mission.api_id)}>
                          <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 10}}>
                            {mission.api_id} {mission.api_name}
                          </span>
                          <span style={{flex: 'none', display: 'flex', alignItems: 'center', width:30, justifyContent: 'space-between'}}>
                          {
                            range(3).map((i) => 
                              <span key={i}>
                                {
                                  (this.state.all_status && this.state.all_status[mission.api_id][i]) ? (
                                    <span className='deckIndicator' style={{backgroundColor: '#0F0'}}/>
                                  ) : (
                                    <span className='deckIndicator' style={{backgroundColor: '#F00'}}/>
                                  )
                                }
                              </span>
                            )
                          }
                          </span>
                        </ListGroupItem>
                      )
                      return (
                        <Tab eventKey={maparea.api_id} key={maparea.api_id} title={maparea.api_name}>
                          <table width='100%' className='expItems'>
                            <tbody>
                              <tr>
                                <td>
                                  {missionDisplays.slice(0, 4)}
                                </td>
                                <td>
                                  {missionDisplays.slice(4, 8)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </Tab>
                      )
                    })
                  )
                }
              </Tabs>
            </Col>
          </Row>
          <Row>
            <Col xs={12}>
              <Panel header={__('Preparation')} bsStyle='default' className='fleetPanel'>
                <table width='100%'>
                  <tbody>
                    <tr>
                      {
                        range(3).map((i) =>
                          <td key={i} width='33.3%'>
                            <OverlayTrigger placement='top' overlay={
                                <Tooltip id={`fleet-${i}-resources`}>
                                  <div>{__('theoretical expedition revenue (per hour)')}</div>
                                  <table width='100%' className='materialTable'>
                                    <tbody>
                                      <tr>
                                        <td width='10%'><img src={getMaterialImage(1)} className='material-icon' /></td>
                                        <td width='40%'>
                                          <div>{this.state.fleet_reward[i][0]} ({this.state.fleet_reward_hour[i][0]})</div>
                                          <div className='text-success'>{this.state.fleet_reward_big[i][0]} ({this.state.fleet_reward_hour_big[i][0]})</div>
                                        </td>
                                        <td width='10%'><img src={getMaterialImage(3)} className='material-icon' /></td>
                                        <td width='40%'>
                                          <div>{this.state.fleet_reward[i][2]} ({this.state.fleet_reward_hour[i][2]})</div>
                                          <div className='text-success'>{this.state.fleet_reward_big[i][2]} ({this.state.fleet_reward_hour_big[i][2]})</div>
                                        </td>
                                      </tr>
                                      <tr>
                                        <td><img src={getMaterialImage(2)} className='material-icon' /></td>
                                        <td>
                                          <div>{this.state.fleet_reward[i][1]} ({this.state.fleet_reward_hour[i][1]})</div>
                                          <div className='text-success'>{this.state.fleet_reward_big[i][1]} ({this.state.fleet_reward_hour_big[i][1]})</div>
                                        </td>
                                        <td><img src={getMaterialImage(4)} className='material-icon' /></td>
                                        <td>
                                          <div>{this.state.fleet_reward[i][3]} ({this.state.fleet_reward_hour[i][3]})</div>
                                          <div className='text-success'>{this.state.fleet_reward_big[i][3]} ({this.state.fleet_reward_hour_big[i][3]})</div>
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </Tooltip>
                              }>
                              <div className='tooltipTrigger'>
                                {__('fleet %s', i + 2)} {this.state.fleet_status[i] ? <FontAwesome key={i * 2} name='check' /> : <FontAwesome key={i * 2 + 1} name='close' />}
                              </div>
                            </OverlayTrigger>
                          </td>
                        )
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
                <Panel header={__('Reward')} bsStyle='default' className='expAward'>
                  <ul>
                    {this.state.expedition_information}
                  </ul>
                </Panel>
                <Panel header={__('Note')} bsStyle='default' className='expCond'>
                  <ul>
                    {this.state.expedition_constraints}
                  </ul>
                </Panel>
              </div>
            </Col>
          </Row>
        </Grid>
      </div>
    )
  }
})
