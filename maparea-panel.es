import React, { PureComponent } from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { Row, Col, Tabs, Tab, ListGroupItem } from 'react-bootstrap'
import { map, range, groupBy } from 'lodash'
import { createSelector } from 'reselect'

import { constSelector } from 'views/utils/selectors'


import {
  fleetsPropertiesSelectorFactory,
  expeditionDataSelector,
} from './selectors'

import { expeditionErrors } from './utils'

class FleetExpeditionIndicator extends PureComponent {
  static propTypes = {
    valid: PropTypes.bool.isRequired,
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

const MapAreaPanel = connect(createSelector([
  constSelector,
  fleetsPropertiesSelectorFactory,
  expeditionDataSelector,
], ({ $missions: $expeditions, $mapareas }, fleetsProperties, expeditionsData) => ({
  mapareas$Expeditions: groupBy($expeditions, 'api_maparea_id'),
  $mapareas: $mapareas || {},
  fleetsProperties,
  expeditionsData,
})))((props) => {
  const {
    $mapareas, mapareas$Expeditions, onSelectExpedition,
    activeExpeditionId, fleetsProperties, expeditionsData,
  } = props
  return (
    <Row>
      <Col xs={12}>
        <Tabs defaultActiveKey={1} animation={false} bsStyle="pills" className="areaTabs" id="areaTabs">
          {
            map($mapareas, ($maparea, mapareaId) => {
              const $expeditions = mapareas$Expeditions[mapareaId]
              if (!$expeditions) {
                return false
              }
              const expeditionDisplays = $expeditions.map(($expedition) => {
                const { api_id } = $expedition
                return (
                  <ListGroupItem
                    key={api_id}
                    className={api_id === activeExpeditionId ? 'active' : ''}
                    style={{ display: 'flex', flexFlow: 'row nowrap', justifyContent: 'space-between' }}
                    onClick={onSelectExpedition(api_id)}
                  >
                    <span style={{
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 10,
                    }}
                    >
                      {$expedition.api_disp_no} {$expedition.api_name}
                    </span>
                    <span style={{
                      flex: 'none', display: 'flex', alignItems: 'center', width: 30, justifyContent: 'space-between',
                    }}
                    >
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
              const mid = Math.max(
                Math.ceil(expeditionDisplays.length / 2),
                4
              )
              return (
                <Tab eventKey={$maparea.api_id} key={$maparea.api_id} title={$maparea.api_name}>
                  <table width="100%" className="expItems">
                    <tbody>
                      <tr>
                        <td>
                          {expeditionDisplays.slice(0, mid)}
                        </td>
                        <td>
                          {expeditionDisplays.slice(mid, expeditionDisplays.length)}
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

export default MapAreaPanel
