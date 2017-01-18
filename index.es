import { join } from 'path-extra'
import React, { Component, PropTypes } from 'react'
import { connect } from 'react-redux'
import { readJsonSync } from 'fs-extra'
import { Grid, Row, Col, Tabs, Tab, ListGroupItem, Panel, OverlayTrigger, Tooltip } from 'react-bootstrap'
import { map, keyBy, sum, join as joinString, range, forEach, flatten, groupBy, get } from 'lodash'
import { createSelector } from 'reselect'
import memoize from 'fast-memoize'
import shallowCompare from 'react-addons-shallow-compare'
import FontAwesome from 'react-fontawesome'

import { arraySum, arrayAdd, arrayMultiply } from 'views/utils/tools'
import { store } from 'views/createStore'
import {
  constSelector,
  shipsSelector,
  fleetShipsIdSelectorFactory,
  fleetShipsDataSelectorFactory,
  fleetShipsEquipDataSelectorFactory,
  extensionSelectorFactory,
} from 'views/utils/selectors'

const { i18n, ROOT, getStore } = window
const __ = i18n['poi-plugin-expedition'].__.bind(i18n['poi-plugin-expedition'])
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
  inexist: 'Expedition not found',
  flagship_unhealthy: 'Flagship heavily damaged',
  resupply: 'Fleet not resupplied',
  flagship_lv: 'Flagship level too low',
  fleet_lv: 'Fleet total level too low',
  flagship_shiptype: 'Incorrect flagship type',
  ship_count: 'Not enough ships',
  drum_ship_count: 'Not enough drum carriers',
  drum_count: 'Not enough drums',
  required_shiptypes: 'Unmet ship type requirements',
  '*': 'Unknown errors',
}
function ErrorList({ errs, liClassName, ulClassName }) {
  return (
    <ul className={ulClassName}>
      {
      errs.map((err) => {
        const rawText = __(constraintError[err] || constraintError['*'])
        return (
          <li key={err} className={liClassName}>
            {rawText}
          </li>
        )
      })
    }
    </ul>
  )
}

function getMaterialImage(idx) {
  return join(ROOT, 'assets', 'img', 'material', `0${idx}.png`)
}

const fleetShipCountSelectorFactory = memoize(fleetId =>
  createSelector(fleetShipsIdSelectorFactory(fleetId),
    shipsId =>
      shipsId == null ? 0 : shipsId.length
  )
)

const fleetFlagshipLvSelectorFactory = memoize(fleetId =>
  createSelector(fleetShipsDataSelectorFactory(fleetId),
    shipsData =>
      shipsData == null || shipsData[0] == null || !shipsData[0].length
        ? 0
        : shipsData[0][0].api_lv
  )
)

const fleetTotalLvSelectorFactory = memoize(fleetId =>
  createSelector(fleetShipsDataSelectorFactory(fleetId),
    shipsData =>
      shipsData == null ? 0 : sum(shipsData.map(shipData =>
        shipData == null || !shipData[0] ? 0 : shipData[0].api_lv
      ))
  )
)

const fleetShipsTypeSelectorFactory = memoize(fleetId =>
  createSelector(fleetShipsDataSelectorFactory(fleetId),
    shipsData =>
      shipsData == null ? [] : shipsData.map(shipData =>
        shipData == null || !shipData[1] ? undefined : shipData[1].api_stype
      )
  )
)

const fleetFlagshipTypeSelectorFactory = memoize(fleetId =>
  createSelector(fleetShipsTypeSelectorFactory(fleetId),
    shipsType =>
      shipsType == null ? undefined : shipsType[0]
  )
)

function isDrum(equipData) {
  return equipData && equipData[1] && equipData[1].api_id == 75
}

// Returns the total number of drums equipped in the fleet
const fleetDrumCountSelectorFactory = memoize(fleetId =>
  createSelector(fleetShipsEquipDataSelectorFactory(fleetId),
    (shipsEquipData = []) =>
      sum(shipsEquipData.map(equipsData =>
        equipsData.filter(isDrum).length
      ))
  )
)

// Returns the total number of ships with a drum equipped in the fleet
const fleetDrumCarrierCountSelectorFactory = memoize(fleetId =>
  createSelector(fleetShipsEquipDataSelectorFactory(fleetId),
    (shipsEquipData = []) =>
      shipsEquipData.filter(equipsData =>
        equipsData.find(isDrum)
      ).length
  )
)

function shipNotHeavilyDamaged(ship) {
  return ship.api_nowhp * 4 >= ship.api_maxhp
}

// Returns false if the flagship is heavily damaged
const fleetFlagshipHealthySelectorFactory = memoize(fleetId =>
  createSelector(fleetShipsDataSelectorFactory(fleetId),
    shipsData =>
      shipsData == null || shipsData[0] == null || !shipsData[0].length
        ? true
        : shipNotHeavilyDamaged(shipsData[0][0])
  )
)

function shipFullyResupplied(shipData = []) {
  const [ship, $ship] = shipData
  return (!ship || !$ship)
    ? true
    : ship.api_fuel >= $ship.api_fuel_max && ship.api_bull >= $ship.api_bull_max
}

// Returns false if any ship is not fully resupplied
const fleetFullyResuppliedSelectorFactory = memoize(fleetId =>
  createSelector(fleetShipsDataSelectorFactory(fleetId),
    shipsData =>
      shipsData == null
        ? true
        : shipsData.every(shipFullyResupplied)
  )
)

function shipMaxResupply(shipData = []) {
  const $ship = shipData[1]
  return (!$ship) ? [0, 0] : [$ship.api_fuel_max, $ship.api_bull_max]
}

// Returns [fuel, bull] consumed to fully resupply every ship from empty
const fleetMaxResupplySelectorFactory = memoize(fleetId =>
  createSelector(fleetShipsDataSelectorFactory(fleetId),
    (shipsData) => {
      const resupplies = shipsData == null ? []
        : shipsData.map(shipMaxResupply)
      return arraySum(resupplies)
    }
  )
)

// for toku daihatsu 特大発動艇, the calculation is seperated into 2 parts
// the former is to see it as normal daihatsu (5%)
// the latter is to calculate extra bonus introduced by itself
const landingCraftsId = {
  68: 5,        // 大発動艇
  166: 2,       // 大発動艇(八九式中戦車&陸戦隊)
  167: 1,       // 特二式内火艇
  193: 5,       // 特大発動艇
}

const shipId = {
  487: 5,
}

// Return [ baseFactorPercentage, starLevel ]
// Return undefined for invalid or empty equips
function landingCraftFactor(equipData) {
  if (!Array.isArray(equipData) || !equipData[0]) {
    return
  }
  console.log(equipData)
  const equip = equipData[0]
  const factor = landingCraftsId[equip.api_slotitem_id]
  if (factor == null) {
    return [0, 0]
  }
  return [factor, equip.api_level || 0]
}

const shipFactor = constIds =>
  constIds.reduce((factor, id) =>
    factor + shipId[id] || 0
  , 0)

const fleetConstShipIdSelectorFactory = memoize(fleetId =>
  createSelector(
    [
      fleetShipsIdSelectorFactory(fleetId),
      shipsSelector,
    ],
    (ids = [], ships) => {
      return ids.map(id => (ships[id] || {}).api_ship_id || -1)
    }
  )
)

// Returns the bonus percentage brought by landing crafts
// e.g. 20 means 20% bonus, or x1.2 factor
const fleetLandingCraftFactorSelectorFactory = memoize(fleetId =>
  createSelector(
    [
      fleetShipsEquipDataSelectorFactory(fleetId),
      fleetConstShipIdSelectorFactory(fleetId),
    ],
    (shipsEquipData = [], constIds) => {
      const landingCrafts = flatten(shipsEquipData.map(equipsData =>
        equipsData.map(landingCraftFactor).filter(Boolean)
      ))
      const lcFactors = arraySum(landingCrafts)
      const baseFactor = Math.min(lcFactors[0] + shipFactor(constIds) || 0, 20)
      const avgStars = (lcFactors[1] / landingCrafts.length) || 0
      const starFactor = 1 * avgStars * baseFactor
      return baseFactor + starFactor
    }
  )
)

const fleetPropertiesSelectorFactory = memoize(fleetId =>
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
      shipCount,
flagshipLv,
totalLv,
shipsType,
flagshipType,
    drumCount,
drumCarrierCount,
flagshipHealthy,
fullyResupplied,
  }))
    /* eslint-enable indent */
)

// Returns [f1, f2, f3] where fx is the fleetProperties of fleet x
// Notice that you should use the form "result[fleetId-1]"
const fleetsPropertiesSelectorFactory = createSelector([
  fleetPropertiesSelectorFactory(1),
  fleetPropertiesSelectorFactory(2),
  fleetPropertiesSelectorFactory(3),
], (f1, f2, f3) => [f1, f2, f3]
)

const expeditionDataSelector = createSelector(
  extensionSelectorFactory(REDUCER_EXTENSION_KEY),
  (state = {}) => state.expeditions || {}
)

const SupportExpeditionData = {
  reward_fuel: 0,
  reward_bullet: 0,
  reward_steel: 0,
  reward_alum: 0,
  reward_items: [],
  flagship_lv: 0,
  fleet_lv: 0,
  flagship_shiptype: 0,
  ship_count: 2,
  drum_ship_count: 0,
  drum_count: 0,
  required_shiptypes: [
    {
      shiptype: [2],
      count: 2,
    },
  ],
  big_success: null,
}

// Returns [ <error_code> ]
function expeditionErrors(fleetProperties, $expedition, expeditionData) {
  const errorInexist = ['inexist']
  const props = fleetProperties     // Make it shorter

  if (!$expedition) {
    return errorInexist
  }
  const expedition = expeditionData || $expedition.api_return_flag == 0 ? SupportExpeditionData : null
  // Has $expedition, but no expedition data, and not a support expedition
  if (!expedition) {
    return errorInexist
  }

  const errs = []
  if (!props.flagshipHealthy) {
    errs.push('flagship_unhealthy')
  }
  if (!props.fullyResupplied) {
    errs.push('resupply')
  }
  if (expedition.flagship_lv != 0 && props.flagshipLv < expedition.flagship_lv) {
    errs.push('flagship_lv')
  }
  if (expedition.fleet_lv != 0 && props.totalLv < expedition.fleet_lv) {
    errs.push('fleet_lv')
  }
  if (expedition.flagship_shiptype != 0 && props.flagshipType != expedition.flagship_shiptype) {
    errs.push('flagship_shiptype')
  }
  if (expedition.ship_count != 0 && props.shipCount < expedition.ship_count) {
    errs.push('ship_count')
  }
  if (expedition.drum_ship_count != 0 && props.drumCarrierCount < expedition.drum_ship_count) {
    errs.push('drum_ship_count')
  }
  if (expedition.drum_count != 0 && props.drumCount < expedition.drum_count) {
    errs.push('drum_count')
  }
  if (expedition.required_shiptypes.length != 0) {
    const valid = expedition.required_shiptypes.every(({ shiptype, count }) =>
      props.shipsType.filter(t => shiptype.includes(t)).length >= count
    )
    if (!valid) {
      errs.push('required_shiptypes')
    }
  }
  return errs
}

// Returns [ normalRewards, greatRewards ]
// where rewards := [ fuel, ammo, steel, bauxite ]
// with errs, landing crafts and resupplies taken into account
const fleetExpeditionRewardsSelectorFactory = memoize((fleetId, expeditionId) =>
  createSelector([
    constSelector,
    expeditionDataSelector,
    fleetLandingCraftFactorSelectorFactory(fleetId),
    fleetMaxResupplySelectorFactory(fleetId),
  ], ({ $missions: $expeditions = {} }, expeditions, lcFactor, maxResupply) => {
    const $expedition = $expeditions[expeditionId]
    if (!$expedition) {
      return [[0, 0, 0, 0], [0, 0, 0, 0]]
    }
    console.log(lcFactor)
    const expedition = expeditions[expeditionId] || SupportExpeditionData
    const baseRewards =
      ['reward_fuel', 'reward_bullet', 'reward_steel', 'reward_alum']
      .map(key => expedition[key])
    const lcRewards = arrayMultiply(baseRewards, 1 + (lcFactor / 100))
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

class FleetExpeditionIndicator extends Component {
  static propTypes = {
    valid: PropTypes.bool,
  }

  shouldComponentUpdate(nextProps, nextState) {
    return shallowCompare(this, nextProps, nextState)
  }

  render() {
    const { valid } = this.props
    const indicatorColor = valid ? '#0F0' : '#F00'
    return (
      <span>
        <span className="deckIndicator" style={{ backgroundColor: indicatorColor }} />
      </span>
    )
  }
}

const MapAreaPanel = connect(
  createSelector([
    constSelector,
    fleetsPropertiesSelectorFactory,
    expeditionDataSelector,
  ], ({ $missions: $expeditions, $mapareas }, fleetsProperties, expeditionsData) => ({
    mapareas$Expeditions: groupBy($expeditions, 'api_maparea_id'),
    $mapareas: $mapareas || {},
    fleetsProperties,
    expeditionsData,
  }))
)((props) => {
  const { $mapareas, mapareas$Expeditions, onSelectExpedition,
    activeExpeditionId, fleetsProperties, expeditionsData } = props
  return (
    <Row>
      <Col xs={12}>
        <Tabs defaultActiveKey={1} animation={false} bsStyle="pills" className="areaTabs" id="areaTabs">
          {
          map($mapareas, ($maparea, mapareaId) => {
            const $expeditions = mapareas$Expeditions[mapareaId]
            if (!$expeditions) {
              return
            }
            const expeditionDisplays = $expeditions.map(($expedition) => {
              const { api_id } = $expedition
              return (
                <ListGroupItem
                  key={api_id}
                  className={api_id == activeExpeditionId ? 'active' : ''}
                  style={{ display: 'flex', flexFlow: 'row nowrap', justifyContent: 'space-between' }}
                  onClick={onSelectExpedition(api_id)}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 10 }}>
                    {api_id} {$expedition.api_name}
                  </span>
                  <span style={{ flex: 'none', display: 'flex', alignItems: 'center', width: 30, justifyContent: 'space-between' }}>
                    {
                    range(1, 4).map((fleetId) => {
                      const errs = expeditionErrors(fleetsProperties[fleetId - 1], $expedition, expeditionsData[api_id])
                      return (
                        <FleetExpeditionIndicator
                          valid={errs.length === 0}
                          key={fleetId}
                        />
                      )
                    })
                  }
                  </span>
                </ListGroupItem>
              )
            })
            return (
              <Tab eventKey={$maparea.api_id} key={$maparea.api_id} title={$maparea.api_name}>
                <table width="100%" className="expItems">
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

const preparationTooltipDataSelectorFactory = memoize((fleetId, expeditionId) =>
  createSelector([
    constSelector,
    fleetExpeditionRewardsSelectorFactory(fleetId, expeditionId),
  ], ({ $missions: $expeditions = {} }, rewards) => ({
    time: ($expeditions[expeditionId] || {}).api_time || 60, // Random non-0 default
    rewards,
  }))
)
const PreparationTooltip = connect(
  (state, { fleetId, expeditionId }) => {
    return preparationTooltipDataSelectorFactory(fleetId, expeditionId)(state)
  }
)(({ errs, rewards: [normalRewards, greatRewards], time, fleetId }) => {
  const valid = errs.length == 0
  let tooltip
  if (valid) {
    const hourly = reward => Math.round((reward / time) * 60)
    const rewardsCell = range(4).map(i => [
      <td key={`1${i}`} width="10%"><img src={getMaterialImage(i + 1)} className="material-icon" /></td>,
      <td key={`2${i}`} width="40%">
        <div>{normalRewards[i]} ({hourly(normalRewards[i])})</div>
        <div className="text-success">{greatRewards[i]} ({hourly(greatRewards[i])})</div>
      </td>,
    ])
    tooltip =
      (<div>
        <div>{__('theoretical expedition revenue (per hour)')}</div>
        <table width="100%" className="expedition-materialTable">
          <tbody>
            <tr>
              {rewardsCell[0] }
              {rewardsCell[2] }
            </tr>
            <tr>
              {rewardsCell[1] }
              {rewardsCell[3]  /* Bauxite */}
            </tr>
          </tbody>
        </table>
      </div>)
  } else {
    tooltip =
      (<div>
        <div>{__('Unmet requirements')}</div>
        <ErrorList
          errs={errs}
          ulClassName="preparation-tooltip-ul"
          liClassName="preparation-tooltip-li"
        />
      </div>)
  }
  return tooltip
})

const preparationPanelDataSelectorFactory = memoize(expeditionId =>
  createSelector([
    constSelector,
    expeditionDataSelector,
    fleetsPropertiesSelectorFactory,
  ], ({ $missions: $expeditions = {} }, expeditionsData, fleetsProps) => ({
    $expedition: $expeditions[expeditionId],
    expeditionData: expeditionsData[expeditionId],
    fleetsProps,
  }))
)
// Connect to empty just to make it pure
const PreparationPanel = connect(
  (state, { expeditionId }) =>
    preparationPanelDataSelectorFactory(expeditionId)(state)
)(({ expeditionId, $expedition, expeditionData, fleetsProps }) => {
  return (
    <Col xs={12}>
      <Panel header={__('Preparation')} bsStyle="default" className="fleetPanel">
        <div className="preparation-row">
          {
          range(1, 4).map((fleetId) => {
            const errs = expeditionErrors(fleetsProps[fleetId - 1], $expedition, expeditionData)
            return (
              <OverlayTrigger
                key={fleetId} placement="top" overlay={
                  <Tooltip id={`expedition-fleet-${fleetId}-resources`}>
                    <PreparationTooltip fleetId={fleetId} expeditionId={expeditionId} errs={errs} />
                  </Tooltip>
              }
              >
                <div className="preparation-cell">
                  <div className="tooltipTrigger preparation-contents">
                    {__('fleet %s', fleetId + 1)}
                    <div className="preparation-check">
                      <FontAwesome name={errs.length === 0 ? 'check' : 'close'} />
                    </div>
                  </div>
                </div>
              </OverlayTrigger>
            )
          })
        }
        </div>
      </Panel>
    </Col>
  )
})

const descriptionPanelDataSelectorFactory = memoize(expeditionId =>
  createSelector([
    constSelector,
    expeditionDataSelector,
  ], ({ $shipTypes, $missions: $expeditions = {} }, expeditions) => ({
    $shipTypes,
    $expedition: $expeditions[expeditionId] || {},
    expedition: expeditions[expeditionId] || {},
  }))
)
// This panel is a static function of expedition, we move the whole render
// into selector
const descriptionPanelRenderSelectorFactory = memoize(expeditionId =>
  createSelector(descriptionPanelDataSelectorFactory(expeditionId),
  ({ $expedition, expedition, $shipTypes }) => {
    // Left panel: Information
    const information = []
    const time = $expedition.api_time || 0
    const hours = Math.floor(time / 60)
    const minutes = time % 60
    information.push(<li key="time">{__('Time')} {hours}:{minutes < 10 ? `0${minutes}` : minutes}</li>)
    information.push(<li key="use_fuel">{__('Consume Fuel')} {$expedition.api_use_fuel * 100 || 0}%</li>)
    information.push(<li key="use_bull">{__('Consume Ammo')} {$expedition.api_use_bull * 100 || 0}%</li>)
    const resourcesKeyText = {
      reward_fuel: 'Fuel',
      reward_bullet: 'Ammo',
      reward_steel: 'Steel',
      reward_alum: 'Bauxite',
    }
    forEach(resourcesKeyText, (text, key) => {
      if (expedition[key] != 0) {
        const perHour = Math.round((expedition[key] * 60) / $expedition.api_time)
        information.push(
          <li key={key}>
            <OverlayTrigger
              placement="right" overlay={
                <Tooltip id={`${key}-per-hour`}>
                  {__(text)} {perHour} / {__('hour(s)')}
                </Tooltip>
              }
            >
              <div className="tooltipTrigger">
                {__(text)} {expedition[key]}
              </div>
            </OverlayTrigger>
          </li>
        )
      }
    })
    if (expedition.reward_items && expedition.reward_items.length != 0) {
      expedition.reward_items.forEach((reward_item, i) => {
        information.push(
          <li key={`reward_items_${reward_item.itemtype}`}>
            {itemNames[reward_item.itemtype]} 0~{reward_item.max_number}
          </li>
          )
      })
    }

    // Right panel: constraints
    const constraints = []
    if (expedition.flagship_lv != 0) {
      constraints.push(<li key="flagship_lv">{__('Flagship Lv.')} {expedition.flagship_lv}</li>)
    }
    if (expedition.fleet_lv != 0) {
      constraints.push(<li key="fleet_lv">{__('Total Lv.')} {expedition.fleet_lv}</li>)
    }
    if (expedition.flagship_shiptype != 0) {
      constraints.push(<li key="flagship_shiptype">{__('Flagship Type')} {get($shipTypes, [expedition.flagship_shiptype, 'api_name'], '???')}</li>)
    }
    if (expedition.ship_count != 0) {
      constraints.push(<li key="ship_count">{__('Number of ships')} {expedition.ship_count} </li>)
    }
    if (expedition.drum_ship_count != 0) {
      constraints.push(<li key="drum_ship_count">{__('Minimum of %s ships carrying drum', expedition.drum_ship_count)}</li>)
    }
    if (expedition.drum_count != 0) {
      constraints.push(<li key="drum_count">{__('number of drum carriers')} {expedition.drum_count}</li>)
    }
    if (expedition.required_shiptypes) {
      expedition.required_shiptypes.forEach((required_shiptype, i) => {
        const stype_name = joinString(required_shiptype.shiptype.map(ship_type => get($shipTypes, [ship_type, 'api_name'], '???')), __(' or '))
        constraints.push(
          <li key={`required_shiptypes_${stype_name}`}>
            {i18n.resources.__(stype_name)} {required_shiptype.count}
          </li>
        )
      })
    }
    if (expedition.big_success) {
      constraints.push(<li key="big_success">{__('Great Success Requirement(s)')}: {expedition.big_success}</li>)
    }

    return (
      <Row>
        <Col xs={12}>
          <div className="expInfo">
            <Panel header={__('Reward')} bsStyle="default" className="expAward">
              <ul>
                {information}
              </ul>
            </Panel>
            <Panel header={__('Note')} bsStyle="default" className="expCond">
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
  (state, { expeditionId }) => ({
    rendered: descriptionPanelRenderSelectorFactory(expeditionId)(state),
  })
)(({ rendered }) => {
  return rendered
})

export const reactClass = connect(
  state => ({
    $expeditions: state.const.$missions,
    expeditionsData: expeditionDataSelector(state),
  }),
  null, null, { pure: false }
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
  handleSelectExpedition = exp_id => () => {
    this.setState({
      expeditionId: exp_id,
    })
  }
  handleResponse = (e) => {
    const { path, postBody } = e.detail
    switch (path) {
    case '/kcsapi/api_req_mission/start': {
      const fleetId = postBody.api_deck_id - 1
      const expeditionId = postBody.api_mission_id
      const { $expeditions, expeditionsData } = this.props
      const fleetProps = fleetPropertiesSelectorFactory(fleetId)(getStore())
      const errs = expeditionErrors(fleetProps, $expeditions[expeditionId], expeditionsData[expeditionId])
      if (errs.length) {
        window.toggleModal(__('Attention!'),
          <div>
            {__("Fleet %s hasn't reach requirements of %s. Please call back your fleet.", fleetId + 1, this.props.$expeditions[expeditionId].api_name)}
            <ErrorList errs={errs} />
          </div>
        )
      }
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
        <link rel="stylesheet" href={join(__dirname, 'assets', 'expedition.css')} />
        <Grid>
          <MapAreaPanel
            activeExpeditionId={this.state.expeditionId}
            onSelectExpedition={this.handleSelectExpedition}
          />
          <Row>
            <PreparationPanel expeditionId={this.state.expeditionId} />
            <DescriptionPanel expeditionId={this.state.expeditionId} />
          </Row>
        </Grid>
      </div>
    )
  }
})

export function reducer(state = {}, action) {
  const { type } = action
  switch (type) {
  case '@@poi-plugin-expedition@init': {
    const expeditionData = readJsonSync(join(__dirname, 'assets', 'expedition.json'))
    return {
      expeditions: keyBy(expeditionData, 'id'),
    }
  }
  }
  return state
}

export function pluginDidLoad() {
  store.dispatch({ type: '@@poi-plugin-expedition@init' })
}
