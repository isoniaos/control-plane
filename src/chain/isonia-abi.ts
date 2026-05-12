import type { Abi } from 'viem';

export const ISONIA_EVENT_ABI = [
  {
    type: 'event',
    name: 'OrganizationCreated',
    inputs: [
      { name: 'orgId', type: 'uint64', indexed: true },
      { name: 'slug', type: 'string', indexed: false },
      { name: 'admin', type: 'address', indexed: true },
      { name: 'metadataURI', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'OrganizationUpdated',
    inputs: [
      { name: 'orgId', type: 'uint64', indexed: true },
      { name: 'metadataURI', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'OrganizationStatusChanged',
    inputs: [
      { name: 'orgId', type: 'uint64', indexed: true },
      { name: 'status', type: 'uint8', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'OrganizationFinalized',
    inputs: [
      { name: 'orgId', type: 'uint64', indexed: true },
      { name: 'admin', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'BodyCreated',
    inputs: [
      { name: 'orgId', type: 'uint64', indexed: true },
      { name: 'bodyId', type: 'uint64', indexed: true },
      { name: 'kind', type: 'uint8', indexed: false },
      { name: 'metadataURI', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'BodyUpdated',
    inputs: [
      { name: 'orgId', type: 'uint64', indexed: true },
      { name: 'bodyId', type: 'uint64', indexed: true },
      { name: 'active', type: 'bool', indexed: false },
      { name: 'metadataURI', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'RoleCreated',
    inputs: [
      { name: 'orgId', type: 'uint64', indexed: true },
      { name: 'roleId', type: 'uint64', indexed: true },
      { name: 'bodyId', type: 'uint64', indexed: true },
      { name: 'roleType', type: 'uint8', indexed: false },
      { name: 'metadataURI', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'RoleUpdated',
    inputs: [
      { name: 'orgId', type: 'uint64', indexed: true },
      { name: 'roleId', type: 'uint64', indexed: true },
      { name: 'active', type: 'bool', indexed: false },
      { name: 'metadataURI', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'MandateAssigned',
    inputs: [
      { name: 'orgId', type: 'uint64', indexed: true },
      { name: 'mandateId', type: 'uint64', indexed: true },
      { name: 'roleId', type: 'uint64', indexed: true },
      { name: 'bodyId', type: 'uint64', indexed: false },
      { name: 'holder', type: 'address', indexed: false },
      { name: 'startTime', type: 'uint64', indexed: false },
      { name: 'endTime', type: 'uint64', indexed: false },
      { name: 'proposalTypeMask', type: 'uint256', indexed: false },
      { name: 'spendingLimit', type: 'uint128', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'MandateRevoked',
    inputs: [
      { name: 'orgId', type: 'uint64', indexed: true },
      { name: 'mandateId', type: 'uint64', indexed: true },
      { name: 'holder', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'PolicyRuleSet',
    inputs: [
      { name: 'orgId', type: 'uint64', indexed: true },
      { name: 'proposalType', type: 'uint8', indexed: true },
      { name: 'version', type: 'uint64', indexed: false },
      { name: 'requiredApprovalBodies', type: 'uint64[]', indexed: false },
      { name: 'vetoBodies', type: 'uint64[]', indexed: false },
      { name: 'executorBody', type: 'uint64', indexed: false },
      { name: 'timelockSeconds', type: 'uint64', indexed: false },
      { name: 'enabled', type: 'bool', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ProposalCreated',
    inputs: [
      { name: 'orgId', type: 'uint64', indexed: true },
      { name: 'proposalId', type: 'uint64', indexed: true },
      { name: 'proposalType', type: 'uint8', indexed: true },
      { name: 'policyVersion', type: 'uint64', indexed: false },
      { name: 'creator', type: 'address', indexed: false },
      { name: 'target', type: 'address', indexed: false },
      { name: 'value', type: 'uint256', indexed: false },
      { name: 'dataHash', type: 'bytes32', indexed: false },
      { name: 'metadataURI', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ProposalApproved',
    inputs: [
      { name: 'orgId', type: 'uint64', indexed: true },
      { name: 'proposalId', type: 'uint64', indexed: true },
      { name: 'bodyId', type: 'uint64', indexed: true },
      { name: 'actor', type: 'address', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ProposalVetoed',
    inputs: [
      { name: 'orgId', type: 'uint64', indexed: true },
      { name: 'proposalId', type: 'uint64', indexed: true },
      { name: 'bodyId', type: 'uint64', indexed: true },
      { name: 'actor', type: 'address', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ProposalQueued',
    inputs: [
      { name: 'orgId', type: 'uint64', indexed: true },
      { name: 'proposalId', type: 'uint64', indexed: true },
      { name: 'queuedAt', type: 'uint64', indexed: false },
      { name: 'executableAt', type: 'uint64', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ProposalExecuted',
    inputs: [
      { name: 'orgId', type: 'uint64', indexed: true },
      { name: 'proposalId', type: 'uint64', indexed: true },
      { name: 'executor', type: 'address', indexed: true },
      { name: 'target', type: 'address', indexed: false },
      { name: 'dataHash', type: 'bytes32', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ProposalCancelled',
    inputs: [
      { name: 'orgId', type: 'uint64', indexed: true },
      { name: 'proposalId', type: 'uint64', indexed: true },
      { name: 'actor', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'ProposalStatusChanged',
    inputs: [
      { name: 'orgId', type: 'uint64', indexed: true },
      { name: 'proposalId', type: 'uint64', indexed: true },
      { name: 'previousStatus', type: 'uint8', indexed: false },
      { name: 'newStatus', type: 'uint8', indexed: false },
    ],
  },
] as const satisfies Abi;
