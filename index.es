import { join } from 'path-extra'
import React, { Component } from 'react'
import { connect } from 'react-redux'
import { readJsonSync } from 'fs-extra'
import { Grid, Row, Col, Tabs, Tab, ListGroupItem, Panel, OverlayTrigger, Tooltip } from 'react-bootstrap'
import { map, keyBy, sum, join as joinString, range, forEach, flatten, groupBy, get } from 'lodash'
import { createSelector } from 'reselect'
import memoize from 'fast-memoize'

import { arraySum, arrayAdd, arrayMultiply } from 'views/utils/tools'
import { extendReducer } from 'views/createStore'
const { FontAwesome, i18n, ROOT } = window

const __ = i18n["poi-plugin-expedition"].__.bind(i18n["poi-plugin-expedition"])
const REDUCER_EXTENSION_KEY = 'poi-plugin-expedition'

const itemNames = [
  '',
  __('Repair Buckets'),
  __('Instant Construction'),
  __('Development Materials'),
  __('Furniture Box Small'),
  __('Furniture Box Medium'),
  __('Furniture Box Large'),
]

const constraintError = {
  'inexist': 'Expedition not found',
  'flagship_unhealthy': 'Flagship heavily damaged',
  'resupply': 'Fleet not resupplied',
  'flagship_lv': 'Flagship level too low',
  'fleet_lv': 'Fleet total level too low',
  'flagship_shiptype': 'Incorrect flagship type',
  'ship_count': 'Not enough ships',
  'drum_ship_count': 'Not enough drum carriers',
  'drum_count': 'Not enough drums',
  'required_shiptypes': 'Unmet ship type requirements',
  '*': 'Unknown errors',
}
function errorsToTexts(errs) {
  const rawText = errs.map((err) => constraintError[err] || constraintError['*'])
  return rawText.map(__)
}
function ErrorList({errs, liClassName, ulClassName}) {
  return (
    <ul className={ulClassName}>
    {
      errorsToTexts(errs).map((text) =>
        <li className={liClassName}>
        {text}
        </li>
      )
    }
    </ul>
  )
}

function getMaterialImage(idx) {
  return join(ROOT, 'assets', 'img', 'material', `0${idx}.png`)
}

import {
  constSelector,
  fleetShipsIdSelectorFactory,
  fleetShipsDataSelectorFactory,
  fleetShipsEquipDataSelectorFactory,
  extensionSelectorFactory,
} from 'views/utils/selectors'

const fleetShipCountSelectorFactory = memoize((fleetId) =>
  createSelector(fleetShipsIdSelectorFactory(fleetId),
    (shipsId) =>
      shipsId == null ? 0 : shipsId.length
  )
)

const fleetFlagshipLvSelectorFactory = memoize((fleetId) =>
  createSelector(fleetShipsDataSelectorFactory(fleetId),
    (shipsData) =>
      shipsData == null || shipsData[0] == null || !shipsData[0].length
        ? 0
        : shipsData[0][0].api_lv
  )
)

const fleetTotalLvSelectorFactory = memoize((fleetId) =>
  createSelector(fleetShipsDataSelectorFactory(fleetId),
    (shipsData) =>
      shipsData == null ? 0 : sum(shipsData.map((shipData) =>
        shipData == null || !shipData[0] ? 0 : shipData[0].api_lv
      ))
  )
)

const fleetShipsTypeSelectorFactory = memoize((fleetId) =>
  createSelector(fleetShipsDataSelectorFactory(fleetId),
    (shipsData) =>
      shipsData == null ? [] : shipsData.map((shipData) =>
        shipData == null || !shipData[1] ? undefined : shipData[1].api_stype
      )
  )
)

const fleetFlagshipTypeSelectorFactory = memoize((fleetId) =>
  createSelector(fleetShipsTypeSelectorFactory(fleetId),
    (shipsType) =>
      shipsType == null ? undefined : shipsType[0]
  )
)

function isDrum(equipData) {
  return equipData && equipData[1] && equipData[1].api_id == 75
}

// Returns the total number of drums equipped in the fleet 
const fleetDrumCountSelectorFactory = memoize((fleetId) =>
  createSelector(fleetShipsEquipDataSelectorFactory(fleetId),
    (shipsEquipData) =>
      sum(shipsEquipData.map((equipsData) =>
        equipsData.filter(isDrum).length
      ))
  )
)

// Returns the total number of ships with a drum equipped in the fleet 
const fleetDrumCarrierCountSelectorFactory = memoize((fleetId) =>
  createSelector(fleetShipsEquipDataSelectorFactory(fleetId),
    (shipsEquipData) =>
      shipsEquipData.filter((equipsData) =>
        equipsData.find(isDrum)
      ).length
  )
)

function shipNotHeavilyDamaged(ship) {
  return ship.api_nowhp * 4 >= ship.api_maxhp
}

// Returns false if the flagship is heavily damaged 
const fleetFlagshipHealthySelectorFactory = memoize((fleetId) =>
  createSelector(fleetShipsDataSelectorFactory(fleetId),
    (shipsData) =>
      shipsData == null || shipsData[0] == null || !shipsData[0].length
        ? true
        : shipNotHeavilyDamaged(shipsData[0][0])
  )
)

function shipFullyResupplied(shipData=[]) {
  const [ship, $ship] = shipData
  return (!ship || !$ship)
    ? true
    : ship.api_fuel >= $ship.api_fuel_max && ship.api_bull >= $ship.api_bull_max
}

// Returns false if any ship is not fully resupplied
const fleetFullyResuppliedSelectorFactory = memoize((fleetId) =>
  createSelector(fleetShipsDataSelectorFactory(fleetId),
    (shipsData) =>
      shipsData == null 
        ? true
        : shipsData.every(shipFullyResupplied)
  )
)

function shipMaxResupply(shipData=[]) {
  const $ship = shipData[1]
  return (!$ship) ? [0, 0] : [$ship.api_fuel_max, $ship.api_bull_max]
}

// Returns [fuel, bull] consumed to fully resupply every ship from empty
const fleetMaxResupplySelectorFactory = memoize((fleetId) =>
  createSelector(fleetShipsDataSelectorFactory(fleetId),
    (shipsData) => {
      const resupplies = shipsData == null ? []
        : shipsData.map(shipMaxResupply)
      return arraySum(resupplies)
    }
  )
)

const landingCraftsId = {
  68: 5,        // 大発動艇
  166: 2,       // 大発動艇(八九式中戦車&陸戦隊)
  167: 1,       // 特二式内火艇
}
// Return [ baseFactorPercentage, starLevel ]
// Return undefined for invalid or empty equips
function landingCraftFactor(equipData) {
  if (!Array.isArray(equipData) || equipData[0])
    return
  const equip = equipData[0]
  const factor = landingCraftsId[equip.api_slotitem_id]
  if (factor == null)
    return [0, 0]
  return [factor, equip.api_level || 0]
}

// Returns the bonus percentage brought by landing crafts
// e.g. 20 means 20% bonus, or x1.2 factor
const fleetLandingCraftFactorSelectorFactory = memoize((fleetId) =>
  createSelector(fleetShipsEquipDataSelectorFactory(fleetId),
    (shipsEquipData) => {
      const landingCrafts = flatten(shipsEquipData.map((equipsData) =>
        equipsData.map(landingCraftFactor).filter(Boolean)
      ))
      const lcFactors = arraySum(landingCrafts)
      const baseFactor = Math.min(lcFactors[0] || 0, 20)
      const avgStars = (lcFactors[1] / landingCrafts.length) || 0
      const starFactor = 1 * avgStars * baseFactor
      return baseFactor + starFactor
    }
  )
)

const fleetPropertiesSelectorFactory = memoize((fleetId) => 
  createSelector([
    fleetShipCountSelectorFactory(fleetId),
    fleetFlagshipLvSelectorFactory(fleetId),
    fleetTotalLvSelectorFactory(fleetId),
    fleetShipsTypeSelectorFactory(fleetId),
    fleetFlagshipTypeSelectorFactory(fleetId),
    fleetDrumCountSelectorFactory(fleetId),
    fleetDrumCarrierCountSelectorFactory(fleetId),
    fleetFlagshipHealthySelectorFactory(fleetId),
    fleetFullyResuppliedSelectorFactory(fleetId),
  ], (shipCount, flagshipLv, totalLv, shipsType, flagshipType,
    drumCount, drumCarrierCount, flagshipHealthy, fullyResupplied) => ({
    /* eslint-disable indent */
      shipCount, flagshipLv, totalLv, shipsType, flagshipType,
    drumCount, drumCarrierCount, flagshipHealthy, fullyResupplied,
  }))
    /* eslint-enable indent */
)

const expeditionDataSelector = createSelector(
  extensionSelectorFactory(REDUCER_EXTENSION_KEY),
  (state={}) => state.expeditions || {}
)

const SupportExpeditionData = {
  "reward_fuel": 0,
  "reward_bullet": 0,
  "reward_steel": 0,
  "reward_alum": 0,
  "reward_items": [],
  "flagship_lv": 0,
  "fleet_lv": 0,
  "flagship_shiptype": 0,
  "ship_count": 2,
  "drum_ship_count": 0,
  "drum_count": 0,
  "required_shiptypes": [
    {
      "shiptype": [2],
      "count": 2,
    },
  ],
  "big_success": null,
}

// Returns [ <error_code> ]
const fleetExpeditionErrorsSelectorFactory = memoize((fleetId, expeditionId) =>
  createSelector([
    constSelector,
    expeditionDataSelector,
    fleetPropertiesSelectorFactory(fleetId),
  ], ({$missions: $expeditions}, expeditions, props) => {
    const $expedition = $expeditions[expeditionId]
    if (!$expedition)
      return ['inexist']
    const expedition = expeditions[expeditionId] ? expeditions[expeditionId] :
      $expedition.api_return_flag == 0 ? SupportExpeditionData : null
    // Has $expedition, but no expedition data, and not a support expedition
    if (!expedition)
      return ['inexist']

    const errs = []
    if (!props.flagshipHealthy)
      errs.push('flagship_unhealthy')
    if (!props.fullyResupplied)
      errs.push('resupply')
    if (expedition.flagship_lv != 0 && props.flagshipLv < expedition.flagship_lv)
      errs.push('flagship_lv')
    if (expedition.fleet_lv != 0 && props.totalLv < expedition.fleet_lv)
      errs.push('fleet_lv')
    if (expedition.flagship_shiptype != 0 && props.flagshipType != expedition.flagship_shiptype)
      errs.push('flagship_shiptype')
    if (expedition.ship_count != 0 && props.shipCount < expedition.ship_count)
      errs.push('ship_count')
    if (expedition.drum_ship_count != 0 && props.drumCarrierCount < expedition.drum_ship_count)
      errs.push('drum_ship_count')
    if (expedition.drum_count != 0 && props.drumCount < expedition.drum_count)
      errs.push('drum_count')
    if (expedition.required_shiptypes.length != 0) {
      const valid = expedition.required_shiptypes.every(({shiptype, count}) =>
        props.shipsType.filter((t) => shiptype.includes(t)).length >= count 
      )
      if (!valid)
        errs.push('required_shiptypes')
    }
    return errs
  })
)

// Returns [ normalRewards, greatRewards ]
// where rewards := [ fuel, ammo, steel, bauxite ]
// with errs, landing crafts and resupplies taken into account
const fleetExpeditionRewardsSelectorFactory = memoize((fleetId, expeditionId) =>
  createSelector([
    constSelector,
    expeditionDataSelector,
    fleetExpeditionErrorsSelectorFactory(fleetId, expeditionId),
    fleetLandingCraftFactorSelectorFactory(fleetId),
    fleetMaxResupplySelectorFactory(fleetId),
  ], ({$missions: $expeditions}, expeditions, errs, lcFactor, maxResupply) => {
    const $expedition = $expeditions[expeditionId]
    if (!$expedition)
      return [[0, 0, 0, 0], [0, 0, 0, 0]]
    const expedition = expeditions[expeditionId] || SupportExpeditionData
    const baseRewards = errs.length ? [0, 0, 0, 0] :
      ["reward_fuel", "reward_bullet", "reward_steel", "reward_alum"]
      .map((key) => expedition[key])
    const lcRewards = arrayMultiply(baseRewards, 1 + lcFactor / 100)
    const resupply = [
      -maxResupply[0] * $expedition.api_use_fuel,
      -maxResupply[1] * $expedition.api_use_bull,
      0,
      0]
    const normalRewards = arrayAdd(lcRewards, resupply).map(Math.floor)
    const greatRewards = arrayAdd(arrayMultiply(lcRewards, 1.5), resupply).map(Math.floor)
    return [normalRewards, greatRewards]
  })
)

const FleetExpeditionIndicator = connect((state, {fleetId, expeditionId}) => ({
  errs: fleetExpeditionErrorsSelectorFactory(fleetId, expeditionId)(state),
})
)(function FleetExpeditionIndicator({errs}) {
  const valid = errs.length == 0
  const indicatorColor = valid ? '#0F0' : '#F00'
  return (
    <span>
      <span className='deckIndicator' style={{backgroundColor: indicatorColor}}/>
    </span>
  )
})

const MapAreaPanel = connect(
  createSelector([
    constSelector,
  ], ({$missions: $expeditions, $mapareas}) => ({
    mapareas$Expeditions: groupBy($expeditions, 'api_maparea_id'),
    $mapareas: $mapareas || {},
  }))
)(function MapAreaPanel({$mapareas, mapareas$Expeditions, onSelectExpedition, activeExpeditionId}) {
  return (
    <Row>
      <Col xs={12}>
        <Tabs defaultActiveKey={1} animation={false} bsStyle='pills' className='areaTabs' id='areaTabs'>
        {
          map($mapareas, ($maparea, mapareaId) => {
            const $expeditions = mapareas$Expeditions[mapareaId]
            if (!$expeditions)
              return
            const expeditionDisplays = $expeditions.map(($expedition) =>
              <ListGroupItem
                key={$expedition.api_id}
                className={$expedition.api_id == activeExpeditionId ? 'active' : '' }
                style={{display: 'flex', flexFlow:'row nowrap', justifyContent:'space-between'}}
                onClick={onSelectExpedition.bind(this, $expedition.api_id)}
              >
                <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 10}}>
                  {$expedition.api_id} {$expedition.api_name}
                </span>
                <span style={{flex: 'none', display: 'flex', alignItems: 'center', width:30, justifyContent: 'space-between'}}>
                {
                  range(1, 4).map((fleetId) => 
                    <FleetExpeditionIndicator fleetId={fleetId} expeditionId={$expedition.api_id} key={fleetId} />
                  )
                }
                </span>
              </ListGroupItem>
            )
            return (
              <Tab eventKey={$maparea.api_id} key={$maparea.api_id} title={$maparea.api_name}>
                <table width='100%' className='expItems'>
                  <tbody>
                    <tr>
                      <td>
                        {expeditionDisplays.slice(0, 4)}
                      </td>
                      <td>
                        {expeditionDisplays.slice(4, 8)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </Tab>
            )
          })
        }
        </Tabs>
      </Col>
    </Row>
  )
})

const preparationCellDataSelectorFactory = memoize((fleetId, expeditionId) =>
  createSelector([
    constSelector,
    fleetExpeditionErrorsSelectorFactory(fleetId, expeditionId),
    fleetExpeditionRewardsSelectorFactory(fleetId, expeditionId),
  ], ({$missions: $expeditions}, errs, rewards) => ({
    time: ($expeditions[expeditionId] || {}).api_time || 60, // Random non-0 default
    errs,
    rewards,
  }))
)
const PreparationCell = connect(
  (state, {fleetId, expeditionId}) => {
    return preparationCellDataSelectorFactory(fleetId, expeditionId)(state)
  }
)(function PreparationCell({errs, rewards: [normalRewards, greatRewards], time, fleetId}) {
  const valid = errs.length == 0
  let tooltip
  if (valid) {
    const hourly = (reward) => Math.round(reward / time * 60)
    const rewardsCell = range(4).map((i) => [
      <td width='10%'><img src={getMaterialImage(i+1)} className='material-icon' /></td>,
      <td width='40%'>
        <div>{normalRewards[i]} ({hourly(normalRewards[i])})</div>
        <div className='text-success'>{greatRewards[i]} ({hourly(greatRewards[i])})</div>
      </td>,
    ])
    tooltip = 
      <div>
        <div>{__('theoretical expedition revenue (per hour)')}</div>
        <table width='100%' className='expedition-materialTable'>
          <tbody>
            <tr>
              {rewardsCell[0]  /* Fuel */   }
              {rewardsCell[2]  /* Steel */  }
            </tr>
            <tr>
              {rewardsCell[1]  /* Ammo */   }
              {rewardsCell[3]  /* Bauxite */}
            </tr>
          </tbody>
        </table>
      </div>
  } else {
    tooltip = 
      <div>
        <div>{__('Unmet requirements')}</div>
        <ErrorList
          errs={errs}
          ulClassName='preparation-tooltip-ul'
          liClassName='preparation-tooltip-li'
          />
      </div>
  }
  return (
    <OverlayTrigger placement='top' overlay={
      <Tooltip id={`expedition-fleet-${fleetId}-resources`}>
      {tooltip}
      </Tooltip>
    }>
      <div className='preparation-cell'>
        <div className='tooltipTrigger preparation-contents'>
          {__('fleet %s', fleetId + 1)}
          <div className='preparation-check'>
            <FontAwesome name={valid ? 'check' : 'close'} />
          </div>
        </div>
      </div>
    </OverlayTrigger>
  )
})

const descriptionPanelDataSelectorFactory = memoize((expeditionId) => 
  createSelector([
    constSelector,
    expeditionDataSelector,
  ], ({$shipTypes, $missions: $expeditions={}}, expeditions) => ({
    $shipTypes,
    $expedition: $expeditions[expeditionId] || {},
    expedition: expeditions[expeditionId] || {},
  }))
)
// This panel is a static function of expedition, we move the whole render
// into selector
const descriptionPanelRenderSelectorFactory = memoize((expeditionId) => 
  createSelector(descriptionPanelDataSelectorFactory(expeditionId),
  ({$expedition, expedition, $shipTypes, expeditionId}) => {
    // Left panel: Information
    const information = []
    const hours = Math.ceil($expedition.api_time / 60)
    const minutes = $expedition.api_time % 60
    information.push(<li key='time'>{__('Time')} {hours}:{minutes < 10 ? `0${minutes}` : minutes}</li>)
    information.push(<li key='use_fuel'>{__('Consume Fuel')} {$expedition.api_use_fuel * 100}%</li>)
    information.push(<li key='use_bull'>{__('Consume Ammo')} {$expedition.api_use_bull * 100}%</li>)
    const resourcesKeyText = {
      reward_fuel: 'Fuel',
      reward_bullet: 'Ammo',
      reward_steel: 'Steel',
      reward_alum: 'Bauxite',
    }
    forEach(resourcesKeyText, (text, key) => {
      if (expedition[key] != 0)
        information.push(
          <li key={key}>
            <OverlayTrigger placement='right' overlay={
              <Tooltip id={`${key}-per-hour`}>
                {__(text)} {Math.round(expedition[key] * 60 / $expedition.api_time)} / {__('hour(s)')}
              </Tooltip>}>
              <div className='tooltipTrigger'>
                {__(text)} {expedition[key]}
              </div>
            </OverlayTrigger>
          </li>
        )
    })
    if (expedition.reward_items && expedition.reward_items.length != 0)
      expedition.reward_items.forEach((reward_item, i) => {
        information.push(<li key={`reward_items_${i}`}>{itemNames[reward_item.itemtype]} 0~{reward_item.max_number}</li>)
      })
  
    // Right panel: constraints
    const constraints = []
    if (expedition.flagship_lv != 0)
      constraints.push(<li key='flagship_lv'>{__('Flagship Lv.')} {expedition.flagship_lv}</li>)
    if (expedition.fleet_lv != 0)
      constraints.push(<li key='fleet_lv'>{__('Total Lv.')} {expedition.fleet_lv}</li>)
    if (expedition.flagship_shiptype != 0)
      constraints.push(<li key='flagship_shiptype'>{__('Flagship Type')} {get($shipTypes, [expedition.flagship_shiptype, 'api_name'], '???')}</li>)
    if (expedition.ship_count != 0)
      constraints.push(<li key='ship_count'>{__('Number of ships')} {expedition.ship_count} </li>)
    if (expedition.drum_ship_count != 0)
      constraints.push(<li key='drum_ship_count'>{__('Minimum of %s ships carrying drum', expedition.drum_ship_count)}</li>)
    if (expedition.drum_count != 0)
      constraints.push(<li key='drum_count'>{__('number of drum carriers')} {expedition.drum_count}</li>)
    if (expedition.required_shiptypes)
      expedition.required_shiptypes.forEach((required_shiptype, i) => {
        const stype_name = joinString(required_shiptype.shiptype.map((ship_type) => get($shipTypes, [ship_type, 'api_name'], '???')), __(' or '))
        constraints.push(<li key={`required_shiptypes_${i}`}>{i18n.resources.__(stype_name)} {required_shiptype.count} </li>)
      })
    if (expedition.big_success)
      constraints.push(<li key='big_success'>{__('Great Success Requirement(s)')}: {expedition.big_success}</li>)
  
    return (
      <Row>
        <Col xs={12}>
          <div className='expInfo'>
            <Panel header={__('Reward')} bsStyle='default' className='expAward'>
              <ul>
                {information}
              </ul>
            </Panel>
            <Panel header={__('Note')} bsStyle='default' className='expCond'>
              <ul>
                {constraints}
              </ul>
            </Panel>
          </div>
        </Col>
      </Row>
    )
  })
)
const DescriptionPanel = connect(
  (state, {expeditionId}) => ({
    rendered: descriptionPanelRenderSelectorFactory(expeditionId)(state),
  })
)(function DescriptionPanel({rendered}) {
  return rendered
})

export const reactClass = connect(
  (state) => ({
    state,
    $expeditions: state.const.$missions,
  }),
  null, null, {pure: false}
)(class PoiPluginExpedition extends Component {
  constructor(props) {
    super(props)
    this.state = {
      expeditionId: 1,
    }
  }
  shouldComponentUpdate(nextProps, nextState) {
    return this.state.expeditionId != nextState.expeditionId
  }
  handleSelectExpedition = (exp_id) => {
    this.setState({
      expeditionId: exp_id,
    })
  }
  handleResponse = (e) => {
    const {path, postBody} = e.detail
    switch (path) {
    case '/kcsapi/api_req_mission/start': {
      const fleetId = postBody.api_deck_id - 1
      const expeditionId = postBody.api_mission_id
      const errs = fleetExpeditionErrorsSelectorFactory(fleetId, expeditionId)(this.props.state)
      if (errs.length)
        window.toggleModal(__('Attention!'),
          <div>
            {__("Fleet %s hasn't reach requirements of %s. Please call back your fleet.", fleetId + 1, this.props.$expeditions[expeditionId].api_name)}
            <ErrorList errs={errs} />
          </div>
        )
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
          <MapAreaPanel
            activeExpeditionId={this.state.expeditionId}
            onSelectExpedition={this.handleSelectExpedition}
          />
          <Row>
            <Col xs={12}>
              <Panel header={__('Preparation')} bsStyle='default' className='fleetPanel'>
                <div className='preparation-row'>
                {
                  range(1, 4).map((i) =>
                    <PreparationCell fleetId={i} expeditionId={this.state.expeditionId} />
                  )
                }
                </div>
              </Panel>
            </Col>
            <DescriptionPanel expeditionId={this.state.expeditionId} />
          </Row>
        </Grid>
      </div>
    )
  }
})

function reducer(state, action) {
  if (!state) {
    const expeditionData = readJsonSync(join(__dirname, 'assets', 'expedition.json'))
    return {
      expeditions: keyBy(expeditionData, 'id'),
    }
  }
  return state
}
setTimeout(()=>extendReducer(REDUCER_EXTENSION_KEY, reducer), 0)
