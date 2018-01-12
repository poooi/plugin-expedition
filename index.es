import { join } from 'path-extra'
import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { readJsonSync } from 'fs-extra'
import { Grid, Row, Col, OverlayTrigger, Tooltip } from 'react-bootstrap'
import { keyBy, sum, join as joinString, range, forEach, get, round } from 'lodash'
import { createSelector } from 'reselect'
import memoize from 'fast-memoize'
import FontAwesome from 'react-fontawesome'

import { store } from 'views/createStore'
import { constSelector } from 'views/utils/selectors'
import { MaterialIcon } from 'views/components/etc/icon'

import ErrorList from './error-list'
import MapAreaPanel from './maparea-panel'
import Panel from './compat-panel'

import {
  fleetsPropertiesSelectorFactory,
  expeditionDataSelector,
  fleetExpeditionRewardsSelectorFactory,
  fleetPropertiesSelectorFactory,
} from './selectors'
import { expeditionErrors } from './utils'

const { i18n, getStore } = window
const __ = i18n['poi-plugin-expedition'].__.bind(i18n['poi-plugin-expedition'])

const itemNames = [
  '',
  __('Repair Buckets'),
  __('Instant Construction'),
  __('Development Materials'),
  __('Furniture Box Small'),
  __('Furniture Box Medium'),
  __('Furniture Box Large'),
]

const preparationTooltipDataSelectorFactory = memoize((fleetId, expeditionId) =>
  createSelector([
    constSelector,
    fleetExpeditionRewardsSelectorFactory(fleetId, expeditionId),
  ], ({ $missions: $expeditions = {} }, rewards) => ({
    time: ($expeditions[expeditionId] || {}).api_time || 60, // Random non-0 default
    rewards,
  })))

const PreparationTooltip = connect(
  (state, { fleetId, expeditionId }) =>
    preparationTooltipDataSelectorFactory(fleetId, expeditionId)(state)
)(({
  errs, rewards, time, fleetId,
}) => {
  const { normalRewards = {}, greatRewards = {}, lcFactor = {} } = rewards
  const { base, star, bonus } = lcFactor
  const valid = errs.length === 0
  let tooltip
  if (valid) {
    const hourly = reward => Math.round((reward / time) * 60)
    const rewardsCell = range(4).map(i => [
      <td key={`1${i}`} width="10%"><MaterialIcon materialId={i + 1} className="material-icon" /></td>,
      <td key={`2${i}`} width="40%">
        <div>{normalRewards[i]} ({hourly(normalRewards[i])})</div>
        <div className="text-success">{greatRewards[i]} ({hourly(greatRewards[i])})</div>
      </td>,
    ])
    tooltip = (
      <div>
        <div>{__('theoretical expedition revenue (per hour)')}</div>
        {base && <div>{__('Daihatsu Landing Craft Bonus: ')}{`+${round(sum([base, star, bonus]), 1)}%`}</div>}
        <table width="100%" className="expedition-materialTable">
          <tbody>
            <tr>
              {rewardsCell[0] }
              {rewardsCell[2] }
            </tr>
            <tr>
              {rewardsCell[1] }
              {rewardsCell[3] /* Bauxite */}
            </tr>
          </tbody>
        </table>
      </div>)
  } else {
    tooltip = (
      <div>
        <div>{__('Unmet requirements')}</div>
        <ErrorList
          errs={errs}
          ulClassName="preparation-tooltip-ul"
          liClassName="preparation-tooltip-li"
          tableClassName="preparation-tooltip-table"
          trClassName="preparation-tooltip-tr"
          tdTextClassName="preparation-tooltip-td-text"
          tdNumberClassName="preparation-tooltip-td-number"
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
  })))
// Connect to empty just to make it pure
const PreparationPanel = connect((state, { expeditionId }) =>
  preparationPanelDataSelectorFactory(expeditionId)(state)
)(({
  expeditionId, $expedition, expeditionData, fleetsProps,
}) => expeditionData ? (
  <Col xs={12}>
    <Panel header={__('Preparation')} bsStyle="default" className="fleetPanel">
      <div className="preparation-row">
        {
          range(1, 4).map((fleetId) => {
            const errs = expeditionErrors(fleetsProps[fleetId - 1], $expedition, expeditionData)
            return (
              <OverlayTrigger
                key={fleetId}
                placement="top"
                overlay={
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
) : (
  <Col xs={12}>
    <Panel header={__('Preparation')} bsStyle="default" className="fleetPanel">
      <div className="preparation-row">
        {__('Infomation for this expedition is not ready.')}
      </div>
    </Panel>
  </Col>
))

const descriptionPanelDataSelectorFactory = memoize(expeditionId =>
  createSelector([
    constSelector,
    expeditionDataSelector,
  ], ({ $shipTypes, $missions: $expeditions = {} }, expeditions) => ({
    $shipTypes,
    $expedition: $expeditions[expeditionId] || {},
    expedition: expeditions[expeditionId] || {},
  })))
// This panel is a static function of expedition, we move the whole render
// into selector
const descriptionPanelRenderSelectorFactory = memoize(expeditionId =>
  createSelector(
    descriptionPanelDataSelectorFactory(expeditionId),
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
        if (expedition[key] > 0) {
          const perHour = Math.round((expedition[key] * 60) / $expedition.api_time)
          information.push(
            <li key={key}>
              <OverlayTrigger
                placement="right"
                overlay={
                  <Tooltip id={`${key}-per-hour`}>
                    {__(text)} {perHour} / {__('hour(s)')}
                  </Tooltip>
                }
              >
                <div className="tooltipTrigger">
                  {__(text)} {expedition[key]}
                </div>
              </OverlayTrigger>
            </li>)
        }
      })
      if (expedition.reward_items && expedition.reward_items.length > 0) {
        expedition.reward_items.forEach((reward_item) => {
          information.push(
            <li key={`reward_items_${reward_item.itemtype}`}>
              {itemNames[reward_item.itemtype]} 0~{reward_item.max_number}
            </li>)
        })
      }

      // Right panel: constraints
      const constraints = []
      if (expedition.flagship_lv > 0) {
        constraints.push(<li key="flagship_lv">{__('Flagship Lv.')} {expedition.flagship_lv}</li>)
      }
      if (expedition.fleet_lv > 0) {
        constraints.push(<li key="fleet_lv">{__('Total Lv.')} {expedition.fleet_lv}</li>)
      }
      if (expedition.flagship_shiptype > 0) {
        constraints.push(<li key="flagship_shiptype">{__('Flagship Type')} {get($shipTypes, [expedition.flagship_shiptype, 'api_name'], '???')}</li>)
      }
      if (expedition.ship_count > 0) {
        constraints.push(<li key="ship_count">{__('Number of ships')} {expedition.ship_count} </li>)
      }
      if (expedition.drum_ship_count > 0) {
        constraints.push(<li key="drum_ship_count">{__('Minimum of %s ships carrying drum', expedition.drum_ship_count)}</li>)
      }
      if (expedition.drum_count > 0) {
        constraints.push(<li key="drum_count">{__('number of drum carriers')} {expedition.drum_count}</li>)
      }
      if (expedition.required_shiptypes) {
        expedition.required_shiptypes.forEach((required_shiptype) => {
          const stype_name = joinString(required_shiptype.shiptype.map(ship_type => get($shipTypes, [ship_type, 'api_name'], '???')), __(' or '))
          constraints.push(<li key={`required_shiptypes_${stype_name}`}>{i18n.resources.__(stype_name)} {required_shiptype.count}</li>)
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
    }
  ))

const DescriptionPanel = connect((state, { expeditionId }) => ({
  rendered: descriptionPanelRenderSelectorFactory(expeditionId)(state),
}))(({ rendered }) => rendered)

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

  componentDidMount() {
    window.addEventListener('game.response', this.handleResponse)
  }

  shouldComponentUpdate(nextProps, nextState) {
    return this.state.expeditionId !== nextState.expeditionId
  }

  componentWillUnmount() {
    window.removeEventListener('game.response', this.handleResponse)
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
          window.toggleModal(
            __('Attention!'),
            <div>
              {__("Fleet %s hasn't reach requirements of %s. Please call back your fleet.", fleetId + 1, this.props.$expeditions[expeditionId].api_name)}
              <ErrorList errs={errs} />
            </div>
          )
        }
        break
      }
      default:
        /* do nothing */
    }
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
    default:
      /* do nothing */
  }
  return state
}

export function pluginDidLoad() {
  store.dispatch({ type: '@@poi-plugin-expedition@init' })
}
