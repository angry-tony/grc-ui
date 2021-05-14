/* Copyright (c) 2020 Red Hat, Inc. */
/* Copyright Contributors to the Open Cluster Management project */

'use strict'

import React from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import {
  ToggleGroup,
  ToggleGroupItem,
  Spinner
} from '@patternfly/react-core'
import {
  AcmTable
} from '@open-cluster-management/ui-components'
import { LocaleContext } from '../common/LocaleContext'
import grcPoliciesViewDef from '../../tableDefinitions/grcPoliciesViewDef'
import grcClustersViewDef from '../../tableDefinitions/grcClustersViewDef'
import { transformNew } from '../../tableDefinitions/utils'
import msgs from '../../nls/platform.properties'
import { formatPoliciesToClustersTableData } from '../../utils/FormatTableData'
import { RESOURCE_TYPES, GRC_SEARCH_STATE_COOKIE } from '../../utils/constants'
import _ from 'lodash'
import { resourceActions } from '../common/ResourceTableRowMenuItemActions'
import formatUserAccess from '../../utils/FormatUserAccess'
import filterUserAction from '../../utils/FilterUserAction'
import { REQUEST_STATUS } from '../../actions/index'
import { createDisableTooltip } from '../common/DisableTooltip'
import {
  getSessionState, replaceSessionPair
} from '../../utils/AccessStorage'

import '../../scss/grc-toggle-module.scss'

const componentName = 'GrcToggleModule'

class GrcToggleModule extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      searchValue : _.get(getSessionState(GRC_SEARCH_STATE_COOKIE), componentName, '')
    }
  }

  static contextType = LocaleContext

  render() {
    const { grcItems, grcTabToggleIndex, handleToggleClick, status } = this.props
    const { locale } = this.context
    const tableType = grcTabToggleIndex === 0 ? 'policies' : 'clusters'
    const tableData = [
      transformNew(grcItems, grcPoliciesViewDef, locale),
      transformNew(formatPoliciesToClustersTableData(grcItems), grcClustersViewDef, locale),
    ]
    if (status !== REQUEST_STATUS.INCEPTION && status !== REQUEST_STATUS.DONE){
      return <Spinner className='patternfly-spinner' />
    }
    const { searchValue, policySortValue, clusterSortValue } = this.state
    const sortValues = [
      policySortValue || tableData[0].sortBy,
      clusterSortValue || tableData[1].sortBy
    ]
    const extraToolbarControls = (
      <ToggleGroup className='grc-toggle-button'>
          <ToggleGroupItem
            buttonId={'grc-policies-view'}
            onChange={handleToggleClick}
            isSelected={grcTabToggleIndex===0}
            text={msgs.get('tabs.grc.toggle.allPolicies', locale)}
            >
          </ToggleGroupItem>
          <ToggleGroupItem
            buttonId={'grc-cluster-view'}
            onChange={handleToggleClick}
            isSelected={grcTabToggleIndex===1}
            text={msgs.get('tabs.grc.toggle.clusterViolations', locale)}
          >
          </ToggleGroupItem>
        </ToggleGroup>
    )
    return (
      <div className='grc-toggle'>
        <div className={`grc-view-by-${tableType}-table`}>
          <AcmTable
            items={tableData[grcTabToggleIndex].rows}
            columns={tableData[grcTabToggleIndex].columns}
            rowActionResolver={this.tableActionResolver}
            addSubRows={tableData[grcTabToggleIndex].addSubRows}
            keyFn={tableData[grcTabToggleIndex].keyFn}
            setSearch={searchValue}
            sort={sortValues[grcTabToggleIndex]}
            setSort={this.setSort(grcTabToggleIndex)}
            gridBreakPoint=''
            extraToolbarControls={extraToolbarControls}
            searchPlaceholder={msgs.get('tabs.grc.toggle.allPolicies.placeHolderText', locale)}
          />
        </div>
      </div>
    )
  }

  handleSearch = (value) => {
    const searchValue = (typeof value === 'string') ? value : ''
    replaceSessionPair(GRC_SEARCH_STATE_COOKIE, componentName, searchValue, true)
    this.setState({
      searchValue: searchValue
    })
  }

  setSort = (grcTabToggleIndex) => {
    return (sortValue) => {
      if (grcTabToggleIndex === 0) {
        this.setState({
          policySortValue: sortValue
        })
      } else {
        this.setState({
          clusterSortValue: sortValue
        })
      }
    }
  }

  tableActionResolver = (rowData) => {
    const { getResourceAction, userAccess, grcTabToggleIndex, history, grcItems } = this.props
    const { locale } = this.context
    let rowName, resourceType, tableActions, rowArray
    // Set table definitions and actions based on toggle position
    if (grcTabToggleIndex === 0) {
      rowName = _.get(rowData, 'name').rawData
      resourceType = RESOURCE_TYPES.POLICIES_BY_POLICY
      tableActions = grcPoliciesViewDef.tableActions
      rowArray = grcItems
    } else {
      rowName = _.get(rowData, 'cluster').rawData
      resourceType = RESOURCE_TYPES.POLICIES_BY_CLUSTER
      tableActions = grcClustersViewDef.tableActions
      rowArray = formatPoliciesToClustersTableData(grcItems)
    }
    const actionsList = []
    const userAccessHash = formatUserAccess(userAccess)
    if (rowName && Array.isArray(rowArray) && rowArray.length > 0) {
      const filteredActions = (Array.isArray(tableActions) && tableActions.length > 0)
        ? filterUserAction(rowData, tableActions, userAccessHash, resourceType)
        : []
      if (_.get(rowData, 'disabled', false)) {
        filteredActions[filteredActions.indexOf('table.actions.policy.disable')] = 'table.actions.policy.enable'
      } else {
        filteredActions[filteredActions.indexOf('table.actions.policy.enable')] = 'table.actions.policy.disable'
      }
      if (_.get(rowData, 'remediation', 'inform') === 'enforce') {
        filteredActions[filteredActions.indexOf('table.actions.enforce')] = 'table.actions.inform'
      } else {
        filteredActions[filteredActions.indexOf('table.actions.inform')] = 'table.actions.enforce'
      }
      if (filteredActions.length > 0) {
        const row = rowArray.find(arrElement => {
          if (grcTabToggleIndex === 0) {
            return _.get(arrElement, 'metadata.name') === rowName
          } else {
            return _.get(arrElement, 'cluster') === rowName
          }
        })
        filteredActions.forEach((action) => {
          const disableFlag = action.includes('disabled.')
          if (disableFlag) {
            action = action.replace('disabled.', '')
          }
          // if consoleURL is unavailable then don't show launch cluster button
          const removeLaunchCluster = (action.includes('launch.cluster')) && ((rowData && !rowData.consoleURL) || (rowData && rowData.consoleURL && rowData.consoleURL === '-'))
          // Push actions for the row
          if (!removeLaunchCluster) {
            actionsList.push(
              {
                id: action,
                title: createDisableTooltip(disableFlag, action, locale, msgs.get(action, locale)),
                isDisabled: disableFlag ? true : false,
                addSeparator: action === 'table.actions.policy.remove' ? true : false,
                click: () =>
                  (disableFlag ? null : getResourceAction(action, row, resourceType, history))
              }
            )
          }
        })
      }
    }
    return actionsList
  }
}

GrcToggleModule.propTypes = {
  getResourceAction: PropTypes.func,
  grcItems: PropTypes.array,
  grcTabToggleIndex: PropTypes.number,
  handleToggleClick: PropTypes.func,
  history: PropTypes.object.isRequired,
  status: PropTypes.string,
  userAccess: PropTypes.array,
}

const mapStateToProps = (state) => {
  const userAccess = state.userAccess ? state.userAccess.access : []

  return {
    status: state[RESOURCE_TYPES.POLICIES_BY_POLICY.query].status,
    userAccess
  }
}

const mapDispatchToProps = (dispatch) => {
  return {
    getResourceAction: (action, resource, resourceType, history) =>
      resourceActions(action, dispatch, resourceType, resource, history)
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(GrcToggleModule)
