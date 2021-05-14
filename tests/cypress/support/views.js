/* Copyright (c) 2020 Red Hat, Inc. */
/* Copyright Contributors to the Open Cluster Management project */

/// <reference types="cypress" />

import { getConfigObject } from '../config'

const closeMenuQuery = 'svg[aria-label="Close menu"]'
const clearAllBtnQuery = 'svg[aria-label="Clear all selected items"]'
const selectItemQuery = 'input[type="checkbox"]'
const timestampRegexp = /^((an?|[0-9]+) (days?|hours?|minutes?|few seconds) ago|in a few seconds)$/

export const pageLoader = {
  shouldExist: () => cy.get('.patternfly-spinner').should('exist')  ,
  shouldNotExist: () => cy.get('.patternfly-spinner').should('not.exist')
}

export const uncheckAllItems = (listQuery, itemQuery=selectItemQuery, useClearAllBtn=true) => {
  // we should use a promise to complete this task first prior moving on
  return new Cypress.Promise((resolve) => {
    cy.then(() => {
      if (!useClearAllBtn) { // uncheck items one by one
      cy.get(listQuery)
        .click()
        .then(() => {
          // get the number of checked items
          const n = Cypress.$(listQuery).find(itemQuery+'[checked]').length
          // uncheck all values that could have been eventually pre-checked
          for (var i=0; i<n; i++) {
            cy.get(listQuery)
              .then(() => {
                if (!Cypress.$(listQuery).find(itemQuery).length) { // drow-down is collapsed, need to expand it manually
                  cy.get(listQuery)
                    .click()
                }
              })
              // better to query the element over an over again as it is being modified with uncheck()
              .get(listQuery).within( () => {
                cy.get(itemQuery)
                  .first()
                  .next('label')
                  .click()
              })
          }
        })
      }
      else { // use the 'clear all' button to clear all selected items at once
        cy.then( () => {
          const arr = Cypress.$(listQuery).find(clearAllBtnQuery)
          if (arr.length) {
            cy.wrap(arr[0])
              .click()
            }
          })
      }
    })
    .then(() => {
      const e = Cypress.$(listQuery).find(closeMenuQuery)
      if (e.length) { // drow-down is not collapsed, need to collapse it manually
        cy.wrap(e)
          .click()
      }
    })
    .then(() => {
      resolve('uncheckAllItems')
    })
  })
}

export const checkItems = (labels, listQuery, itemQuery=selectItemQuery, clear=true) => {
  // we should use a promise to complete this task first prior moving on
  return new Cypress.Promise((resolve) => {
    // clear existing selection first
    cy.get(listQuery).parent().within((parent) => {
      if(clear && Cypress.$(parent).find('.pf-c-select__toggle-clear').length > 0){
        cy.get('.pf-c-select__toggle-clear').click()
      }
    })
    // now check all the required values
    let selected = false
    cy.get(listQuery)
      .then(() => {
      for (const label of labels) {
        cy.get(listQuery)
          .click()
          .get(listQuery).parent().within(() => {
            cy.get('input.pf-c-select__toggle-typeahead')
              .first()
              .as('input')
          })
          .get('@input')
          .type(label)
          .get(listQuery).parent().next().within(() => {
            cy.get(itemQuery)
              .contains(label).within((button) => {
                if(Cypress.$(button).find('span').length > 0){
                  // already selected, do nothing
                  selected = true
                } else {
                  cy.get(button).click()
                }
              })
          }).then(()=>{
            if (selected) {
              // close dropdown
              cy.get(listQuery).click()
            }
          })
        }
      })
      .then(() => {
        resolve('checkItems')
      })
  })
}

export const verifyItemsChecked = (labels, listQuery) => {
  // we should use a promise to complete this task first prior moving on
  return new Cypress.Promise((resolve) => {
    // now check all the required values
    cy.get(listQuery)
      .then(() => {
        for (const label of labels) {
          cy.get(listQuery).prev().prev().within(() => {
            cy.get('span').contains(label)
          })
        }
      })
      .then(() => {
        resolve('verifyItemsChecked')
      })
  })
}


export const selectItems = async (labels, listQuery, itemQuery='.pf-c-select__menu-item', labelQuery='.bx--checkbox-label', verifyChecked=true) => {
  uncheckAllItems(listQuery, itemQuery)
  .then( () => {
    if (labels.length) {
      cy.then(() => {
        checkItems(labels, listQuery, itemQuery, labelQuery)
      })
      .then(() => {
        if (verifyChecked) {
          verifyItemsChecked(labels, listQuery)
        }
      })
    }
  })
  //.then(() => { uncheckAllItems(listQuery, itemQuery) })  // this is here just if needed to test that uncheck works
}


export const getDefaultSubstitutionRules = (rules = {}) => {
  if (rules['label'] == undefined) {
    if (Cypress.env('MANAGED_CLUSTER_NAME') !== undefined) {
      rules['label'] = `- {key: name, operator: In, values: ["${Cypress.env('MANAGED_CLUSTER_NAME')}"]}`
    } else {
      rules['label'] = '[]'
    }
  }
  if (rules['id'] == undefined) {
    if (Cypress.env('RESOURCE_ID')) {
      rules['id'] = Cypress.env('RESOURCE_ID')
    }
  }
  if (rules['namespace'] == undefined) {
    rules['namespace'] = 'default'
  }
  const substitutions = []
  for (const [key, value] of Object.entries(rules)) {
    substitutions.push([new RegExp('\\['+key.toUpperCase()+'\\]', 'g'), value])
  }
  return substitutions
}

export const action_createPolicyFromYAML = (policyYAML, create=true) => {
  cy/*.toggleYAMLeditor('On')*/
    .YAMLeditor()
    .invoke('setValue', policyYAML)
    .waitForDocumentUpdate()
    // create
    .then(() => {
      if (create) {
        cy.get('#create').click()
        cy.CheckGrcMainPage()
      }
    })
}

// this function is mainly used to testing selection on the create policy page
export const action_createPolicyFromSelection = (uPolicyName, create=true, policyConfig) => {
  // fill the form uName
  cy.get('input[aria-label="name"]')
    .clear()
    .type(uPolicyName)
  // namespace
  if (policyConfig['namespace']) {
    cy.get('.pf-c-select__toggle-button[aria-label="namespace"]')
      .click()
      .parent().next()
      .contains(policyConfig['namespace'])
      .click()
  }
  //specs
  if (policyConfig['specifications']) {
    cy.then(() => {
      selectItems(policyConfig['specifications'], '.pf-c-select__toggle-button[aria-label="specs"]')
    })
  }
  // cluster binding
  if (policyConfig['cluster_binding']) {
    cy.then(() => {
      selectItems(policyConfig['cluster_binding'], '.pf-c-select__toggle-button[aria-label="clusters"]')
    })
  }
  // standards
  if (policyConfig['standards']) {
    cy.then(() => {
      selectItems(policyConfig['standards'], '.pf-c-select__toggle-button[aria-label="standards"]')
    })
  }
  // categories
  if (policyConfig['categories']) {
    cy.then(() => {
      selectItems(policyConfig['categories'], '.pf-c-select__toggle-button[aria-label="categories"]')
    })
  }
  // controls
  if (policyConfig['controls']) {
    cy.then(() => {
      selectItems(policyConfig['controls'], '.pf-c-select__toggle-button[aria-label="controls"]')
    })
  }
  // remediation
  if (policyConfig['remediation']) {
    cy.then(() => {
      if (policyConfig['remediation']) {
        cy.get('input[name="remediation-enforce"][type="radio"]')
          .click()
      }
    })
  }
  // disable
  if (policyConfig['disable']) {
    cy.then(() => {
      if (policyConfig['disable']) {
        cy.get('input[aria-label="disabled"][type="checkbox"]')
          .click()
      }
    })
  }
  // create
  cy.then(() => {
    if (create) {
      cy.get('#create').click()
      // after creation, always return to grc main page
      cy.CheckGrcMainPage()
    }
  })
}

// this function verify whether create policy form contain values matching the policy configuration
// oldPolicyName is used only to wait for a form update (since we cannot use wait() )
export const action_verifyCreatePolicySelection = (policyName, policyConfig) => {
  // first wait for the form update
  //cy.get('#name').invoke('val').should('not.match', /policy-grc/)
  // now check the updated policy name
  cy.get('#name').invoke('val').should('match', new RegExp('^'+policyName+'$'))
  // namespace
  if (policyConfig['namespace']) {
    cy.get('.pf-c-select__toggle-button[aria-label="namespace"]').prev().invoke('attr', 'value').contains(new RegExp('^'+policyConfig['namespace']+'$'))
  }
  //specs
  if (policyConfig['specifications']) {
    cy.then(() => {
        verifyItemsChecked(policyConfig['specifications'], '.pf-c-select__toggle-button[aria-label="specs"]')
      })
      // also check that the number of selected items matches
      .get('.pf-c-select__toggle-button[aria-label="specs"]').prev().prev()
      .find('li').should('have.length', policyConfig['specifications'].length)
  }
  // cluster binding
  if (policyConfig['cluster_binding']) {
    cy.then(() => {
        verifyItemsChecked(policyConfig['cluster_binding'], '.pf-c-select__toggle-button[aria-label="clusters"]')
      })
      // also check that the number of selected items matches
      .get('.pf-c-select__toggle-button[aria-label="clusters"]').prev().prev()
      .find('li').should('have.length', policyConfig['cluster_binding'].length)
  }
  // standards
  if (policyConfig['standards']) {
    cy.then(() => {
        verifyItemsChecked(policyConfig['standards'], '.pf-c-select__toggle-button[aria-label="standards"]')
      })
      // also check that the number of selected items matches
      .get('.pf-c-select__toggle-button[aria-label="standards"]').prev().prev()
      .find('li').should('have.length', policyConfig['standards'].length)
  }
  // categories
  if (policyConfig['categories']) {
    cy.then(() => {
        verifyItemsChecked(policyConfig['categories'], '.pf-c-select__toggle-button[aria-label="categories"]')
      })
      // also check that the number of selected items matches
      .get('.pf-c-select__toggle-button[aria-label="categories"]').prev().prev()
      .find('li').should('have.length', policyConfig['categories'].length)
  }
  // controls
  if (policyConfig['controls']) {
    cy.then(() => {
        verifyItemsChecked(policyConfig['controls'], '.pf-c-select__toggle-button[aria-label="controls"]')
      })
      // also check that the number of selected items matches
      .get('.pf-c-select__toggle-button[aria-label="controls"]').prev().prev()
      .find('li').should('have.length', policyConfig['controls'].length)
  }
  // enforce
  if (policyConfig['remediation']) {
    cy.then(() => {
      if (policyConfig['remediation']) {
        cy.get('input[name="remediation-enforce"][type="radio"]').should('be.checked')
      } else {
        cy.get('input[name="remediation-enforce"][type="radio"]').should('not.be.checked')
      }
    })
  }
  // disable
  if (policyConfig['disable']) {
    cy.then(() => {
      if (policyConfig['disable']) {
        cy.get('input[aria-label="disabled"][type="checkbox"]').should('be.checked')
      } else {
        cy.get('input[aria-label="disabled"][type="checkbox"]').should('not.be.checked')
      }
    })
  }
}


// enabled='enabled', checking if policy is enabled; enabled='disabled', checking if policy is disabled
// targetStatus = 0, don't check policy status; targetStatus = 1, check policy status is non-violation
// targetStatus = 2, check policy status is violation; targetStatus = 3, check policy status is pending
export const action_verifyPolicyInListing = (
  uName, policyConfig, enabled='enabled',
  violationsCounter='', targetStatus = null
  ) => {
  if (targetStatus == null) {
    if (violationsCounter && violationsCounter[0] != '[') {
      targetStatus = violationsCounter.startsWith('0/') ? 1 : 2
    }
    else if (enabled == 'disabled') {
      targetStatus = 3
    } else {
      targetStatus = 0
    }
  }
  cy.doTableSearch(uName)
    .get('.grc-view-by-policies-table').within(() => {
    cy.log(uName)
    cy.get('a').contains(uName).parents('td').siblings('td')
    .spread((toggle, namespace, remediation, violations, standards) => {
      // check namespace
      if (policyConfig['namespace']) {
        cy.wrap(namespace).contains(policyConfig['namespace'].trim(), { matchCase: false })
      }
      // check enforce/inform
      if (policyConfig['remediation'] == true) {
        cy.wrap(remediation).contains('enforce', { matchCase: false })
      } else if (policyConfig['remediation'] == false) {
        cy.wrap(remediation).contains('inform', { matchCase: false })
      }
      // check the violation status
      if ([1,2,3].includes(targetStatus)) {
        cy.wrap(violations).find('svg').then((elems) => {
          if (elems.length === 1) {
            cy.get('.violationCell>svg').should('have.attr', 'fill', getStatusIconFillColor(targetStatus))
          }
        })
      }
      // check the cluster violations value
      if (violationsCounter) {
        cy.wrap(violations.textContent).should('match', new RegExp('^'+violationsCounter+'$'))
      }
      // check standard
      if (policyConfig['standards']) {
        for (const std of policyConfig['standards']) {
          cy.wrap(standards).contains(std.trim())
        }
      }
      // check categories
      if (policyConfig['categories']) {
        cy.wrap(toggle).click()
        for (const cat of policyConfig['categories']) {
          cy.get('td[data-label="Categories"]').contains(cat.trim())
        }
        cy.wrap(toggle).click()
      }
      // check controls
      if (policyConfig['controls']) {
        cy.wrap(toggle).click()
        for (const ctl of policyConfig['controls']) {
          cy.get('td[data-label="Controls"]').contains(ctl.trim())
        }
        cy.wrap(toggle).click()
      }
    })

    if (enabled.toLowerCase() === 'disabled') { // check disabled policy
      cy.get('a')
      .contains(uName)
      .siblings('span')
      .contains('disabled', { matchCase: false })
      .then(() => isPolicyStatusAvailable(uName)) // check policy status, it should not be available
      .then((v) => expect(v).to.be.false)
    } else { // check enabled policy
      cy.get('a')
        .contains(uName)
        .siblings('span')
        .should('not.exist')
    }
  })
  cy.clearTableSearch()
}

export const action_verifyPolicyNotInListing = (uName) => {
  // either there are no policies at all or there are some policies listed
  if (!Cypress.$('#page').find('div.no-resource'.length)) {
    cy.get('.grc-view-by-policies-table').within(() => {
      cy.get('a')
        .contains(uName)
        .should('not.exist')
    })
  }
}

export const action_actionPolicyActionInListing = (uName, action, cancel=false) => {
  cy.CheckGrcMainPage()
    .doTableSearch(uName)
    .get('.grc-view-by-policies-table').within(() => {
    cy.get('a')
      .contains(uName)
      .parents('td')
      .siblings('td')
      .last().within(() => {
        cy.get('button').click()
      })
  })
  .then(() => {
    cy.get('button').contains(action, { matchCase: false }).click()
  })
  .then(() => {
    cy.get('.pf-c-modal-box').within(() => {
      if (cancel) {
        cy.get('button').contains('Cancel', { matchCase: false })
          .click()
      } else {
        cy.get('button').contains(action, { matchCase: false })
          .click()
      }
    })
  })
  // wait for the dialog to be closed
  .then(() => {
    cy.get('.pf-c-modal-box').should('not.exist')
  })
  // after mainpage table action, always return to grc main page
  cy.CheckGrcMainPage()
    .clearTableSearch()
}

// needs to be run at /multicloud/policies/all at ClusterViolations tab
// optionally, specific violationsCounter value can be provided
export const isClusterViolationsStatusAvailable = (name, violationsCounter) => {
  let statusAvailable = false
  // page /multicloud/policies/all
  return cy.then(() => {
    cy.get('[aria-label="Simple Table"]').within(() => {
      cy.get('a').contains(name).parents('td').siblings('td').spread((namespace, counter) => {
        // check the violation status
        cy.wrap(counter).find('path').then((elems) => {
          // when STANDALONE_TESTSUITE_EXECUTION === FALSE, elems.length could be 2, only check the first icon in such case
          if (elems.length === 1 || (elems.length === 2 && Cypress.env('STANDALONE_TESTSUITE_EXECUTION') === 'FALSE')) {
            const d = elems[0].getAttribute('d')
            // M569 seem to be unique to an icon telling that policy status is not available for some cluster
            statusAvailable = !d.startsWith('M569')
            if (statusAvailable && violationsCounter) { // also check if violations counter matches
              if (!counter.textContent.match('\\b'+violationsCounter+'\\b')) { // not found
                statusAvailable = false
              }
            }
          }
        })
      })
    })
    .then(() => statusAvailable)
  })
}



// needs to be run either at /multicloud/policies/all or /multicloud/policies/all/{namespace}/{policy} page
// here statusPending = true to check consist pending status for disable policy
export const isPolicyStatusAvailable = (uName, violationsCounter) => {
  let statusAvailable = false
  // page /multicloud/policies/all
  //if (window.location.toString().endsWith('/multicloud/policies/all')) {
return cy.url().then((pageURL) => {
  if (pageURL.endsWith('/multicloud/policies/all')) {
    cy.get('[aria-label="Simple Table"]').within(() => {
    cy.get('a').contains(uName).parents('td').siblings('td').spread((namespace, remediation, violations) => {
      // check the violation status
      cy.wrap(violations).find('path').then((elems) => {
        if (elems.length === 1) {
          const d = elems[0].getAttribute('d')
          // M569 seem to be unique to an icon telling that policy status is not available for some cluster
          statusAvailable = !d.startsWith('M569')
          if (statusAvailable && violationsCounter) { // also check if violations counter matches
            if (!violations.textContent.match('\\b'+violationsCounter+'\\b')) { // not found
              statusAvailable = false
            }
          }
        }
      })
    })
  })
  .then(() => statusAvailable)
  } else { // other pages
    cy.get('.violationCell').spread((violations) => {
      // check the violation status
      cy.wrap(violations).find('path').then((elems) => {
        if (elems.length == 1) {
          const d = elems[0].getAttribute('d')
          // M569 seem to be unique to an icon telling that policy status is not available for some cluster
          statusAvailable = !d.startsWith('M569')
        }
      })
    })
    .then(() => statusAvailable)
  }
})
}

// needs to be run only on /multicloud/policies/all/default/${policyName}/status
// where it checks whether all listed (e.g. filtered) templates have status
export const isClusterTemplateStatusAvailable = (clusterViolations = {}) => {
  let statusAvailable = true
  // search for the template status in a table
  return cy.then(() => {
    cy.get('tbody').within(() => {
      cy.get('tr').each((row) => {
        cy.wrap(row).find('td').spread((cluster, status, template) => {
          const clusterName = cluster.textContent.trim()
          const templateName = template.textContent.trim()
          if (clusterViolations[clusterName]) {  // do the check only if we have violation details for the cluster
            // get respective violation ID
            let violationID
            for (const patternId of clusterViolations[clusterName]) {
              const name = patternId.replace(/-[^-]*$/, '')
              const id = patternId.replace(/^.*-/, '')
              if (templateName == name) {
                violationID = id
                break
              }
            }
            const clusterStatus = getPolicyStatusForViolationId(violationID)
            // check the cluster status
            if (! status.textContent.match(new RegExp(clusterStatus))) {
              statusAvailable = false
            }
          } else {  // we do not know the expected status, only check the icon
            cy.wrap(status).find('path').then((elems) => {
              if (elems.length === 1) {
                const d = elems[0].getAttribute('d')
                // M569 seem to be unique to an icon telling that policy status is not available for some cluster
                if (d.startsWith('M569')) {
                  statusAvailable = false
                }
              } else {
                statusAvailable = false
              }
            })
          }
        })
      })
    })
    .then(() => statusAvailable )
  })
}

export const action_verifyPolicyInPolicyDetails = (
  uName, policyConfig, enabled='enabled',
  violationsCounter='', targetStatus = null
  ) => {
  if (targetStatus == null) {
    if (violationsCounter && violationsCounter[0] != '[') {
      targetStatus = violationsCounter.startsWith('0/') ? 1 : 2
    }
    else if (enabled == 'disabled') {
      targetStatus = 3
    } else {
      targetStatus = 0
    }
  }
  //cy.get('div.vertical-expend').then((e) => {
  cy.get('#compliance\\.details').within(() => {
    cy.get('div.pf-c-description-list__text').spread((
      name, namespace, remediation, disabled, violations,
      categories, controls, standards, created
      ) => {
      // check name
      cy.wrap(name).contains(uName)
      // check namespace
      if (policyConfig['namespace']) {
        cy.wrap(namespace).contains(policyConfig['namespace'])
      }
      // check enforce/inform
      if (policyConfig['remediation'] == true) {
        cy.wrap(remediation).contains('enforce', { matchCase: false })
      } else if (policyConfig['remediation'] == false) {
        cy.wrap(remediation).contains('inform', { matchCase: false })
      }
      // check state
      if (enabled == 'enabled') {
        cy.wrap(disabled).contains('false')
      } else {
        cy.wrap(disabled).contains('true')
      }
      if ([1,2,3].includes(targetStatus)) {
        // check the violation status
        cy.wrap(violations).find('svg').then((elems) => {
          if (elems.length === 1) {
            cy.get('.violationCell>svg').should('have.attr', 'fill', getStatusIconFillColor(targetStatus))
          }
        })
      }
      // check violations counter
      if (violationsCounter) {
        cy.wrap(violations).contains(new RegExp('^'+violationsCounter+'$'))
      }
      // check categories
      if (policyConfig['categories']) {
        for (const cat of policyConfig['categories']) {
          cy.wrap(categories).contains(cat)
        }
      }
      // check controls
      if (policyConfig['controls']) {
        for (const ctl of policyConfig['controls']) {
          cy.wrap(controls).contains(ctl)
        }
      }
      // check standard
      if (policyConfig['standards']) {
        for (const std of policyConfig['standards']) {
          cy.wrap(standards).contains(std)
        }
      }
      // check creation time
      cy.wrap(created).contains(timestampRegexp)
    })
  })
}

const getStatusIconFillColor = (targetStatus) => {
  switch(targetStatus) {
    case 1: // 3e8635 is the unique non-volation status color
    case 'compliant':
      return '#3e8635'
    case 2: // c9190b is the unique violation status color
    case 'not compliant':
      return '#c9190b'
    case 3:
    default: // f0ab00 is the unique pending status color
    case 'no status':
      return '#f0ab00'
  }
}

// will add more check to enhance it later
export const verifyPolicyInPolicyStatus = (uName) => {
  cy.get('.pf-c-toggle-group__button').contains('Templates')
  .click()
  .then(() => {
    cy.get('.policy-status-by-templates-table .pf-c-title').contains(uName)
    verifyPolicyInPolicyHistory(uName)
  })
}

// will add more check to enhance it later
export const verifyPolicyInPolicyHistory = (uName) => {
  cy.get('tbody tr td a').contains('View history', { matchCase: false }).first()
  .click()
  .then(() => {
    cy.get('div h4').contains(uName, { matchCase: false })
  })
}

// export const verifyPolicyByYAML = (uName, originalYAML, ingoreClusterSelector=true) => {
//   cy.CheckGrcMainPage()
//   cy.get('.grc-view-by-policies-table').within(() => {
//     cy.get('a')
//       .contains(uName)
//       .parents('td')
//       .siblings('td')
//       .last()
//       .click()
//   })
//   .then(() => {
//     cy.get('button').contains('Edit', { matchCase: false }).click()
//   })
//   .then(() => {
//     cy.get('.pf-c-modal-box').within(() => {
//       cy.log(ingoreClusterSelector)
//       // // eslint-disable-next-line cypress/no-assigning-return-values
//       // const acutalYAML = cy.YAMLeditor().first().invoke('getValue')
//       // cy.log(acutalYAML)
//     })
//   })

//   // after mainpage table action, always return to grc main page
//   cy.CheckGrcMainPage()
// }

export const getPolicyTemplatesNameAndKind = (policyName, policyConfig) => {
  const templates = new Set()
  for (const specification of policyConfig['specifications']) {
    const shortSpec = specification.split('-')[0].trim() // get only part before '-'

    switch(shortSpec) {
    case 'CertificatePolicy':
      templates.add(policyName+'-cert-expiration'+'/'+'CertificatePolicy')
      break
    case 'ComplianceOperator':
      templates.add('comp-operator-ns'+'/'+'ConfigurationPolicy')
      templates.add('comp-operator-operator-group'+'/'+'ConfigurationPolicy')
      templates.add('comp-operator-subscription'+'/'+'ConfigurationPolicy')
      break
    case 'EtcdEncryption':
      templates.add(policyName+'-etcd-encryption'+'/'+'ConfigurationPolicy')
      break
    case 'GatekeeperOperator':
      templates.add('gatekeeper-operator-ns'+'/'+'ConfigurationPolicy')
      templates.add('gatekeeper-operator-catalog-source'+'/'+'ConfigurationPolicy')
      templates.add('gatekeeper-operator-group'+'/'+'ConfigurationPolicy')
      templates.add('gatekeeper-operator-subscription'+'/'+'ConfigurationPolicy')
      templates.add('gatekeeper'+'/'+'ConfigurationPolicy')
      break
    case 'IamPolicy':
      templates.add(policyName+'-limit-clusteradmin'+'/'+'IamPolicy')
      break
    case 'ImageManifestVulnPolicy':
      templates.add(policyName+'-image-vulnerability'+'/'+'ConfigurationPolicy')
      templates.add(policyName+'-image-vulnerability-sub'+'/'+'ConfigurationPolicy')
      break
    case 'LimitRange':
      templates.add(policyName+'-container-mem-limit-range'+'/'+'ConfigurationPolicy')
      break
    case 'Namespace':
      templates.add(policyName+'-prod-ns'+'/'+'ConfigurationPolicy')
      break
    case 'Pod':
      templates.add(policyName+'-nginx-pod'+'/'+'ConfigurationPolicy')
      break
    case 'PodSecurityPolicy':
      templates.add(policyName+'-restricted-psp'+'/'+'ConfigurationPolicy')
      break
    case 'Role':
      templates.add(policyName+'-deployments-role'+'/'+'ConfigurationPolicy')
      break
    case 'RoleBinding':
      templates.add(policyName+'-operatoruser-rolebinding'+'/'+'ConfigurationPolicy')
      break
    case 'SecurityContextConstraints':
      templates.add(policyName+'-restricted-scc'+'/'+'ConfigurationPolicy')
      break
    }
  }
  return Array.from(templates)
}

// from the set of known violations per cluster read just violations relevant for the particular policy
export const getViolationsPerPolicy = (policyName, policyConfig, clusterViolations, clusters = undefined) => {
  const violations = {}
  const templates = getPolicyTemplatesNameAndKind(policyName, policyConfig)
  if (clusters == undefined) {  // clusters were not defined, get a list of all cluster names from the clusterViolations dictionary
    clusters = Object.keys(clusterViolations).filter((value) => { return value != '*' }) // get all keys except the default/wildcard '*' when present
  }
  for (const cluster of clusters) {
    violations[cluster] = []
  }
  for (const template of templates) {
    const templateName = template.split('/', 2)[0]
    for (const cluster of clusters) {
      let violationList = []  // will contain a list of violations for the specific cluster
      if (cluster in clusterViolations) {  // I know violations for the specific cluster in clusterViolations
        violationList = clusterViolations[cluster]
      }
      else if ('*' in clusterViolations) {  // I am using the default/wildcard '*' settings from clusterViolations
        violationList = clusterViolations['*']
      }
      for (const clusterViolation of violationList) {
        // if violation pattern ID matches the template name and a number or ?, add it to the list
        if (clusterViolation.match(new RegExp('^'+templateName+'-[0-9?]+$'))) {
          violations[cluster].push(clusterViolation)
        }
      }
    }
  }
  return violations
}

export const getClusterPolicyStatus = (clusterViolations, format='long') => {
  // in theory there could be multiple violations found by one policy
  // or multiple compliance statuses when one policy has multiple specifications
  // if the policy status would be unknown return '?'
  let result = 'Compliant'
  for (const violation of clusterViolations) {
    const id = violation.replace(/^.*-/, '')
    if (id == '?') {  // if the status is unknown
      result = '(Compliant|Not compliant)'
    } else if (id[0] != '0') {  // if there is an actual violation (non-zero ID)
      result = 'Not compliant'
      break
    }
  }
  if (format == 'short') {
    switch (result) {
      case 'Not Compliant':
        return 'NonCompliant'
      case 'Compliant':
        return 'Compliant'
      default:
        return '(Compliant|NonCompliant)'
    }
  } else {
    return result
  }
}


export const getViolationsCounter = (clusterViolations) => {
  let violations = 0
  const clusters = Object.keys(clusterViolations).length
  for (const cluster in clusterViolations) {
    // in theory there could be multiple violations found by one policy
    // also, if the policy has multiple specifications there could be even multiple compliances
    for (const violation of clusterViolations[cluster]) {
      const id = violation.replace(/^.*-/, '')
      if (id == '?') { // unspecific violation
        return '[0-9]+/'+clusters
      }
      if (id[0] != '0') {  // if there is an actual violation (non-zero ID)
        violations = violations + 1
        break  // stop checking this server
      }
    }
  }
  return violations+'/'+clusters
}

// does the search using the search form
// so far tested only on the policy status page
export const action_doTableSearch = (text, inputSelector = null, parentSelector = null) => {
  if (inputSelector === null) {
    inputSelector = 'input[aria-label="Search input"]'
  }
  cy.get('div.page-content-container')  // make sure the page is loaded enough
    .then(() => {
      // do the search only if there are resources on the page
      // if (!Cypress.$('#page').find('div.no-resource').length) {
        // FIXME - do this search without a force
      cy.get(inputSelector, {withinSubject: parentSelector}).clear({force: true}).type(text, {force: true})
      // }
    })
}

export const action_clearTableSearch = (inputSelector = null, parentSelector = null) => {
  if (inputSelector === null) {
    inputSelector = 'input[aria-label="Search input"]'
  }
  cy.get('div.page-content-container')  // make sure the page is loaded enough
    .then(() => {
      // clear the search only if there are resources on the page
      if (!Cypress.$('#page').find('div.no-resource').length) {
        // FIXME - do this without a force
        cy.get(inputSelector, {withinSubject: parentSelector}).clear({force: true})
      }
    })
}


export const action_verifyViolationsInPolicyStatusClusters = (policyName, policyConfig, clusterViolations, violationPatterns, clusters = undefined) => {
  if (clusters == undefined) {
    clusters = Object.keys(clusterViolations)
  }
  for (const cluster of clusters) {
    for (const patternId of clusterViolations[cluster]) {
      // from a messageId having format "templateName-id' parse both templateName and id
      const templateName = patternId.replace(/-[^-]*$/, '')
      const id = patternId.replace(/^.*-/, '')
      // now use the search to better target the required policy and to get it on the first page
      cy.doTableSearch(templateName)
      // first we need to sort rows per Cluster name and later Template name to make sure they won't reorder in case some cluster state is updated - if this
      // happens, field values won't match expectations
      cy.get('th[data-label="Cluster"]').within(() => {
        cy.get('button').click()
      })
      cy.get('th[data-label="Template"]').within(() => {
        cy.get('button').click()
      })
      cy.get('tbody').within(() => {
        // now find the appropriate row with the cluster name
        cy.get('td').contains(new RegExp('^'+cluster+'$')).parents('td').siblings('td').spread((clusterStatus, template, message, lastReport, history) => {
          // check status
          const expectedStatus = getPolicyStatusForViolationId(id)
          cy.wrap(clusterStatus).contains(new RegExp(expectedStatus))
          // check status icon
          // FIXME: we are not checking status icon if we do not know the expected policy status
          if (id != '?') {
            const fillColor = getStatusIconFillColor(expectedStatus.toLowerCase())
            cy.wrap(clusterStatus).find('svg').should('have.attr', 'fill', fillColor)
          }
          // double-check template
          cy.wrap(template).contains(templateName)
          // check message
          // FIXME: here we should have a function that split the content per ';' and tests each part agains Compliant/NonCompliant and expected messages
          if (id == '?') {
            cy.wrap(message).contains(new RegExp('(NonCompliant|Compliant); '+violationPatterns[templateName][id]))
          } else if (id[0] == '0') {
            cy.wrap(message).contains(new RegExp('Compliant; '+violationPatterns[templateName][id]))
          } else {
            cy.wrap(message).contains(new RegExp('NonCompliant; '+violationPatterns[templateName][id]))
          }
          // check last report timestamp
          cy.wrap(lastReport).contains(timestampRegexp)
          // check View history link
          cy.wrap(history).within(() => {
            cy.get('a').contains('View history')
            const url_pattern = `/multicloud/policies/all/${policyConfig['namespace']}/${policyName}/status/${cluster}/templates/${templateName}/history$`
            cy.get('a').invoke('attr', 'href').then((target) => { cy.wrap(target).should('match', new RegExp(url_pattern)) })
          })
        })
      })
    }
  }
  cy.clearTableSearch()
}

export const getPolicyStatusForViolationId = (id, format='long') => {
  if (format == 'long') {
    switch(id[0]) {  // take just the first digit
      case '?':
        return '(Not compliant|Compliant)'
      case '0':
        return 'Compliant'
      default:
        return 'Not compliant'
    }
  }
  if (format == 'short') {
    switch(id[0]) {
      case '?':
        return '(NonCompliant|Compliant)'
      case '0':
        return 'Compliant'
      default:
        return 'NonCompliant'
    }
  }
}

export const action_verifyViolationsInPolicyStatusTemplates = (policyName, policyConfig, clusterViolations, violationPatterns, clusters = undefined) => {
  if (clusters == undefined) {
    clusters = Object.keys(clusterViolations)
  }
  for (const cluster of clusters) {
    for (const patternId of clusterViolations[cluster]) {
      // from a messageId having format "templateName-id' parse both templateName and id
      const templateName = patternId.replace(/-[^-]*$/, '')
      const id = patternId.replace(/^.*-/, '')
      // now find the right search (there could be more) to better target the required cluster result and to get it on the first page
      // FIXME: this should be replaced by a separate function/command doing this, ideally without 'force'
      cy.get('h4').contains(new RegExp('^'+templateName+'$')).parent('div.policy-status-by-templates-table').as('form')
      cy.get('@form').then(e => cy.doTableSearch(cluster, null, e))
      cy.get('@form').within(() => {
        cy.get('tbody').within(() => {
          cy.get('td').contains(new RegExp('^'+cluster+'$')).parents('td').siblings('td').spread((clusterStatus, message, lastReport, history) => {
            // check status
            const expectedStatus = getPolicyStatusForViolationId(id)
            cy.wrap(clusterStatus).contains(new RegExp(expectedStatus))
            // check status icon
            // FIXME: we are not checking status icon if we do not know the expected policy status
            if (id != '?') {
              const fillColor = getStatusIconFillColor(expectedStatus.toLowerCase())
              cy.wrap(clusterStatus).find('svg').should('have.attr', 'fill', fillColor)
            }
            // check message
            // FIXME: here we should have a function that split the content per ';' and tests each part agains Compliant/NonCompliant and expected messages
            if (id == '?') {
              cy.wrap(message).contains(new RegExp('(NonCompliant|Compliant); '+violationPatterns[templateName][id]))
            } else if (id[0] == '0') {
              cy.wrap(message).contains(new RegExp('Compliant; '+violationPatterns[templateName][id]))
            } else {
              cy.wrap(message).contains(new RegExp('NonCompliant; '+violationPatterns[templateName][id]))
            }
            // check last report timestamp
            cy.wrap(lastReport).contains(timestampRegexp)
            // check View history link
            cy.wrap(history).within(() => {
              cy.get('a').contains('View history')
              const url_pattern = `/multicloud/policies/all/${policyConfig['namespace']}/${policyName}/status/${cluster}/templates/${templateName}/history$`
              cy.get('a').invoke('attr', 'href').then((target) => { cy.wrap(target).should('match', new RegExp(url_pattern)) })
            })
          })
        })
      })
    }
  }
}

export const action_verifyPolicyDetailsInCluster =  (policyName, policyConfig, clusterName, clusterViolations, violationPatterns) => {
  const clusterStatus = getClusterPolicyStatus(clusterViolations[clusterName], 'short')
  cy.get('section[aria-label="Policy details"]').within(() => {
    cy.get('.bx--structured-list-td').spread((nameLabel, name, clusterLabel, cluster, messageLabel, message, statusLabel, status, remediationLabel, remediation ) => {
      // verify namespace
      if (policyConfig['namespace']) {
        cy.wrap(name).contains(policyConfig['namespace']+'.'+policyName)
      }
      // verify cluster name
      cy.wrap(cluster).contains(clusterName)
      // verify cluster status
      cy.wrap(status).contains(new RegExp(clusterStatus))
      // verify policy remediation settings
      policyConfig['remediation'] === true ? cy.wrap(remediation).contains('enforce') : cy.wrap(remediation).contains('inform')
      // verify the message
      // first check that the right ammount of messages is listed
      const number_of_messages = (message.textContent.match(/Compliant[,;]/g) || []).length
      const violations = clusterViolations[clusterName]
      expect(number_of_messages).to.equal(violations.length)
      // verify that each violation/compliance message is present
      for (const violation of violations) {
        const templateName = violation.replace(/-[^-]*$/, '')
        const id = violation.replace(/^.*-/, '')
        const clusterStatus2 = getPolicyStatusForViolationId(id, 'short')
        const pattern = violationPatterns[templateName][id]
        if (clusterStatus2 == 'NonCompliant') {
          cy.wrap(message).contains(new RegExp(templateName+': '+clusterStatus2+'; '+pattern))
        } else {
          cy.wrap(message).contains(new RegExp(templateName+': '+clusterStatus2))
        }
      }
    })
  })
}

export const action_verifyClusterListInPolicyDetails = (policyConfig, clusterViolations, checkLength=true) => {
  cy.get('div.cluster-list').within(() => {
    // Check headings
    cy.get('table > thead > tr > th').spread((
      label1, label2, label3
    ) => {
      cy.wrap(label1).should('have.text', 'Cluster selector')
      cy.wrap(label2).should('have.text', 'Clusters')
      cy.wrap(label3).should('have.text', 'Status')
    })
    cy.get('table > tbody > tr > td').spread((
      selector, clusters, status
    ) => {
      // check binding selector
      if (policyConfig['binding_selector']) {
        // FIXME: in theory there could be multiple bindings
        cy.wrap(selector).should('have.text', policyConfig['binding_selector'][0].replace(/\s/g, ''))
      }
      // check cluster statuses
      if (clusterViolations) {
        // check the number of clusters listed matches the configuration
        // for each cluster check that the expected status is listed and links correctly
        if (checkLength) {
          cy.wrap(status).find('a').should('have.length', Object.keys(clusterViolations).length)
          cy.wrap(clusters).contains(Object.keys(clusterViolations).length)
        }
        cy.then(() => {
          for (const clusterName in clusterViolations) {
            cy.wrap(status).within(() => {
              // find cluster name
              cy.get('a').contains(clusterName).as('clusterStatus').invoke('text').should('match', new RegExp(`^${clusterName}[, ]{0,2}$`))
              cy.get('@clusterStatus').parents('.status-list').siblings('.status-heading').get('.table-status-row').children().spread((icon, status) => {
                // check status
                const clusterStatusExp = getClusterPolicyStatus(clusterViolations[clusterName])
                const clusterStatus = new RegExp(`^${clusterStatusExp}[:]`)
                cy.wrap(status.textContent).should('match', clusterStatus)
                if (!clusterStatusExp.startsWith('(')) {
                  // check status icon only if we absolutely know the status
                  const fillColor = getStatusIconFillColor(clusterStatusExp.toLowerCase())
                  cy.wrap(icon).find('svg[fill="'+fillColor+'"]').should('exist')
                }
              })
            })
          }
        })
      }
    })
  })
}

export const action_verifyPolicyTemplatesInCluster = (policyName, policyConfig, clusterName, clusterViolations) => {
  const violations = clusterViolations[clusterName]
  for (const violation of violations) {
    const templateName = violation.replace(/-[^-]*$/, '')
    const id = violation.replace(/^.*-/, '')
    cy.doTableSearch(templateName, '#policyTemplates-search')
      .get('#policyPolicyTemplates-module-id').within(() => {

      cy.get('tbody').children('tr[data-row-name="'+templateName+'"]').find('td').spread((name, api, kind, compliant) => {
        cy.wrap(name).contains(policyName)
        if(policyConfig['apiVersion']) {
          cy.wrap(api).contains(policyConfig['apiVersion'])
        }
        if(policyConfig['kind']) {
          cy.wrap(kind).contains(policyConfig['kind'])
        }
        const clusterStatus = getPolicyStatusForViolationId(id).toLowerCase()
        cy.wrap(compliant).contains(new RegExp(clusterStatus))
        // check status icon
        // FIXME: we are now doing the check only if we know the the status
        if (id != '?') {
          const fillColor = getStatusIconFillColor(clusterStatus)
          cy.wrap(compliant).find('svg').should('have.attr', 'fill', fillColor)
        }
      })
    })
    cy.clearTableSearch('#policyTemplates-search')
  }
}

export const action_verifyPolicyViolationDetailsInCluster = (policyName, policyConfig, clusterName, clusterViolations, violationPatterns) => {
  const violations = clusterViolations[clusterName]
  for (const violation of violations) {
    const templateName = violation.replace(/-[^-]*$/, '')
    const id = violation.replace(/^.*-/, '')
    const pattern = violationPatterns[templateName][id]
    const clusterStatus = getClusterPolicyStatus(violations, 'short')
    cy.doTableSearch(templateName, '#violations-search')
      .get('#policyViolations-module-id').within(() => {
      cy.get('tbody').children('tr[data-row-name="'+templateName+'"]').find('td').spread((name, cluster, message, last_update) => {
        // check policy name
        cy.wrap(name).contains(policyName)
        // check cluster name
        cy.wrap(cluster).contains(clusterName)
        // check violation message
        cy.wrap(message).contains(new RegExp(clusterStatus+'[,;] '+pattern))
        // check last results date
        cy.wrap(last_update).contains(timestampRegexp)
      })
    })
    cy.clearTableSearch('#violations-search')
  }
}

export const action_verifyPolicyViolationDetailsInHistory = (templateName, violations, violationPatterns) => {
  cy.get('table[aria-label="Simple Table"]').within(() => {
    for (const violation of violations) {
      const id = violation.replace(/^.*-/, '')
      const pattern = violationPatterns[templateName][id]
      const policyStatus = getPolicyStatusForViolationId(id)
      // this is tricky, sometimes the message is directly in <td> and sometimes in <span> inside that <td>
      // therefore we will be approaching it via the parent <tr>
      cy.get('td').contains(new RegExp(pattern)).parents('tr').find('td').spread((state, message, timestamp) => {
        cy.wrap(state).contains(new RegExp(policyStatus))
        cy.wrap(timestamp).contains(/^(an?|[0-9]+) (days?|hours?|minutes?|few seconds) ago$/)
      })
    }
  })
}

export const action_checkNotificationMessage = (kind, title, notification, close=true) => {
  cy.get('div[aria-label="'+kind+'"]').within(() => {
    cy.get('.pf-c-alert__title').should('contain', title)
    cy.get('.pf-c-alert__description').invoke('text').should('contain', notification)
    if (close) {
      cy.get('.pf-c-alert__action > button').click()  // close the message
    }
  })
}

export const verifyPolicyTemplateViolationDetailsForCluster = (policyName, policyConfig, clusterName, clusterViolations, violationPatterns) => {
  const violations = clusterViolations[clusterName]
  const clusterStatus = getClusterPolicyStatus(violations, 'short')
  cy.get('div.overview').find('div.pf-c-description-list__text').spread((name, cluster, kind, api, compliant, details) => {
    // check name
    cy.wrap(name).contains(policyName)
    // check cluster name
    cy.wrap(cluster).contains(clusterName)
    // check policy kind
    if (policyConfig['kind']) {
      cy.wrap(kind).contains(policyConfig['kind'])
    }
    // check apiVersion
    if (policyConfig['apiVersion']) {
      cy.wrap(api).contains(policyConfig['apiVersion'])
    }
    // check status
    cy.wrap(compliant).contains(new RegExp(clusterStatus))
    // check details
    for (const violation of violations) {
      const templateName = violation.replace(/-[^-]*$/, '')
      const id = violation.replace(/^.*-/, '')
      const pattern = violationPatterns[templateName][id]
      cy.wrap(details).contains(pattern)
    }
  })
}

export const action_verifyClusterViolationsInListing = (clusterName, violationsCounter = '', violatedPolicies = [], targetStatus = null) => {
  if (targetStatus == null) {
    if (violationsCounter && violationsCounter[0] != '[') {
      targetStatus = violationsCounter.startsWith('0/') ? 1 : 2
    } else {
      targetStatus = 0
    }
  }
  cy.doTableSearch(clusterName)
    .get('table[aria-label="Simple Table"]').within(() => {
    cy.get('a').contains(clusterName).parents('td').siblings('td')
    .spread((namespace, violations, policies) => {
      // FIXME: skip namespace
      // check the violation status
      if ([1,2].includes(targetStatus)) {
        cy.wrap(violations).find('svg').then((elems) => {
          if (elems.length === 1) {
            cy.get('.violationCell>svg').should('have.attr', 'fill', getStatusIconFillColor(targetStatus))
          }
        })
      }
      // check the cluster violations counter value
      if (violationsCounter) {
        cy.wrap(violations.textContent).should('match', new RegExp('^'+violationsCounter+'$'))
      } else {
        cy.wrap(violations.textContent).should('match', /^[0-9]+\/[0-9]+$/)
      }
      // check violated policies
      // in fact there is no sense checking it precisely since policy listing woudl be truncated in the UI
      if (violatedPolicies.length > 0) {
        if (policies.textContent.includes('..')) {  // policy listing is truncated
          const [prefix, suffix] = policies.textContent.split('...', 2)
          const allPolicies = violatedPolicies.join()
          expect(allPolicies).to.contain(prefix)
          expect(allPolicies).to.contain(suffix)
        } else {  // listing is not truncated
          for (const policyName of violatedPolicies) {
            cy.wrap(policies).contains(policyName)
          }
        }
      }
    })
  })
  cy.clearTableSearch()
}

export const getClusterViolationsCounterAndPolicyList = (clusterName, clusterList, confFileViolations, confPolicies) => {
  let counter = 0
  const violatedPolicies = []
  let violationCounter = ''

  // first we need to find out the proper violationsCounter value by counting violated policies
  for (const policyName in confPolicies) {
    // we need to do the substitution per policy
    const confClusterViolations = getConfigObject(confFileViolations, 'yaml', getDefaultSubstitutionRules({policyname:policyName}))
    const clusterViolations = getViolationsPerPolicy(policyName, confPolicies[policyName], confClusterViolations, clusterList)
    // in theory there could be multiple violations found by one policy
    // also, if the policy has multiple specifications there could be even multiple compliances
    for (const violation of clusterViolations[clusterName]) {
      const id = violation.replace(/^.*-/, '')
      if (id == '?') { // unspecific violation, we won't ever know exact value of violationCounter
        counter = '?'
      } else if (counter != '?' && id[0] != '0') {  // if there is an actual violation (non-zero ID)
        counter = counter + 1
        violatedPolicies.push(policyName)
        break  // stop checking this policy
      }
    }
  }
  // now build a regexp for violationCounter based on counter and violatedPolicies
  if (counter == '?') {
    violationCounter = '[0-9]+/' + Object.keys(confPolicies).length.toString()
  } else {
    violationCounter = counter.toString() + '/' + Object.keys(confPolicies).length.toString()
  }
  return [ violationCounter, violatedPolicies]
}

// parse policy name from a raw policy YAML
// returns string
export const parsePolicyNameFromYAML = (rawPolicyYAML) => {
  return rawPolicyYAML.replace(/\r?\n|\r/g, ' ').replace(/^.*?name:\s*/m, '').replace(/\s.*/m,'')
}

// the function does check the content of the /multicloud/policies/all page with respect to the user permissions
// arguments:
//   policyNames = array of policy names that are expected to be found
//   confPolicies = dictionary storing policy configurations where policyName is a key
//   permissions = user permissions
//   elevated = true if a user has multiple permissions for different namespaces and Create policy button should be enabled
//   searchFilter = filter to be used in the Search field to limit the scope of a test
export const action_checkPolicyListingPageUserPermissions = (policyNames = [], confPolicies = {}, permissions = {}, elevated = false, searchFilter='') => {

 const policyCount = policyNames.length

  // check whether Create button is enabled/disabled
  const createBtnState = permissions.create || elevated ? 'false' : 'true'
  cy.get('#create-policy').should('have.attr', 'aria-disabled', createBtnState)

  // check policy listing
  if (policyCount > 0) {
    // there should be policies listed let's check them
    // enter the filter first
    cy.doTableSearch(searchFilter)  // clears the search eventually
    // check total number of policies listed
    cy.get('div.pf-c-pagination').find('b').last().contains(new RegExp(`^${policyCount}$`))
    // check each policy is listed
    for (const policyName of policyNames) {
      cy.verifyPolicyInListing(policyName, confPolicies[policyName])
    }
    // check Actions menu for the first policy
   cy.doTableSearch(policyNames[0])
   // all users should be able to click the Action button
   cy.get('.grc-view-by-policies-table').within(() => {  // click the Action button
      cy.get('button[aria-label="Actions"]').first().click()
        .then(() => {
          for (const action of ['Edit', 'Disable', 'Enforce']) {
            if (permissions.patch) {
              cy.get('button.pf-c-dropdown__menu-item').contains(action, { matchCase: false }).should('have.attr', 'aria-disabled', 'false')
            } else {
              cy.get('button.pf-c-dropdown__menu-item').contains(action, { matchCase: false }).parent().should('have.attr', 'aria-disabled', 'true')
            }
          }
          if (permissions.delete) {
            cy.get('button.pf-c-dropdown__menu-item').contains('Remove', { matchCase: false }).should('have.attr', 'aria-disabled', 'false')
          } else {
            cy.get('button.pf-c-dropdown__menu-item').contains('Remove', { matchCase: false }).parent().should('have.attr', 'aria-disabled', 'true')
          }
        })
        // close the menu again
        cy.get('button[aria-label="Actions"]').first().click()
      })

  } else if (searchFilter) {
    // some policies should be filtered out
    cy.doTableSearch(searchFilter)
      .get('h2.pf-c-title').contains('No results found')
  } else {
    // no policies should be listed at all
    cy.checkPolicyNoResourcesIconMessage(false, 'No policies found')
    // check whether Create button below is enabled/disabled
    const createBtnState = permissions.create || elevated ? 'enabled' : 'disabled'
    cy.get('#create-resource').should(`be.${createBtnState}`)
  }
  cy.clearTableSearch()

}
