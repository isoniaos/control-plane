import {
  BODY_KIND_CHAIN_MAP,
  type Address,
  type BodyCreatedEventArgsDto,
  type BodyUpdatedEventArgsDto,
  BodyKind,
  type Bytes32Hash,
  type GovernanceEventArgsDto,
  GovernanceEventName,
  type JsonObject,
  type MandateAssignedEventArgsDto,
  type MandateRevokedEventArgsDto,
  type OrganizationCreatedEventArgsDto,
  type OrganizationFinalizedEventArgsDto,
  type OrganizationStatusChangedEventArgsDto,
  type OrganizationUpdatedEventArgsDto,
  ORGANIZATION_STATUS_CHAIN_MAP,
  OrganizationStatus,
  type PolicyRuleSetEventArgsDto,
  type ProposalApprovedEventArgsDto,
  type ProposalCancelledEventArgsDto,
  type ProposalCreatedEventArgsDto,
  type ProposalExecutedEventArgsDto,
  type ProposalQueuedEventArgsDto,
  PROPOSAL_STATUS_CHAIN_MAP,
  PROPOSAL_TYPE_CHAIN_MAP,
  ProposalStatus,
  ProposalType,
  type ProposalStatusChangedEventArgsDto,
  type ProposalVetoedEventArgsDto,
  ROLE_TYPE_CHAIN_MAP,
  type RoleCreatedEventArgsDto,
  type RoleUpdatedEventArgsDto,
  RoleType,
} from '@isonia/types';
import { asString, asStringArray } from './json';

export interface DecodedGovernanceLog {
  readonly eventName: GovernanceEventName;
  readonly args: GovernanceEventArgsDto | JsonObject;
}

const GOVERNANCE_EVENT_NAMES: ReadonlySet<string> = new Set(
  Object.values(GovernanceEventName),
);

export function normalizeDecodedGovernanceLog(
  eventName: string,
  args: Record<string, unknown>,
): DecodedGovernanceLog | undefined {
  if (!isGovernanceEventName(eventName)) {
    return undefined;
  }

  switch (eventName) {
    case GovernanceEventName.OrganizationCreated:
      return {
        eventName,
        args: {
          orgId: asString(args.orgId),
          slug: asString(args.slug),
          adminAddress: asAddress(args.admin),
          metadataUri: asString(args.metadataURI),
        } satisfies OrganizationCreatedEventArgsDto,
      };
    case GovernanceEventName.OrganizationUpdated:
      return {
        eventName,
        args: {
          orgId: asString(args.orgId),
          metadataUri: asString(args.metadataURI),
        } satisfies OrganizationUpdatedEventArgsDto,
      };
    case GovernanceEventName.OrganizationStatusChanged:
      return {
        eventName,
        args: {
          orgId: asString(args.orgId),
          status: toOrganizationStatus(args.status),
        } satisfies OrganizationStatusChangedEventArgsDto,
      };
    case GovernanceEventName.OrganizationFinalized:
      return {
        eventName,
        args: {
          orgId: asString(args.orgId),
          admin: asAddress(args.admin),
        } satisfies OrganizationFinalizedEventArgsDto,
      };
    case GovernanceEventName.BodyCreated:
      return {
        eventName,
        args: {
          orgId: asString(args.orgId),
          bodyId: asString(args.bodyId),
          kind: toBodyKind(args.kind),
          metadataUri: asString(args.metadataURI),
        } satisfies BodyCreatedEventArgsDto,
      };
    case GovernanceEventName.BodyUpdated:
      return {
        eventName,
        args: {
          orgId: asString(args.orgId),
          bodyId: asString(args.bodyId),
          active: Boolean(args.active),
          metadataUri: asString(args.metadataURI),
        } satisfies BodyUpdatedEventArgsDto,
      };
    case GovernanceEventName.RoleCreated:
      return {
        eventName,
        args: {
          orgId: asString(args.orgId),
          roleId: asString(args.roleId),
          bodyId: asString(args.bodyId),
          roleType: toRoleType(args.roleType),
          metadataUri: asString(args.metadataURI),
        } satisfies RoleCreatedEventArgsDto,
      };
    case GovernanceEventName.RoleUpdated:
      return {
        eventName,
        args: {
          orgId: asString(args.orgId),
          roleId: asString(args.roleId),
          active: Boolean(args.active),
          metadataUri: asString(args.metadataURI),
        } satisfies RoleUpdatedEventArgsDto,
      };
    case GovernanceEventName.MandateAssigned:
      return {
        eventName,
        args: {
          orgId: asString(args.orgId),
          mandateId: asString(args.mandateId),
          roleId: asString(args.roleId),
          bodyId: asString(args.bodyId),
          holderAddress: asAddress(args.holder),
          startTime: asString(args.startTime),
          endTime: asString(args.endTime),
          proposalTypeMask: asString(args.proposalTypeMask),
          spendingLimit: asString(args.spendingLimit),
        } satisfies MandateAssignedEventArgsDto,
      };
    case GovernanceEventName.MandateRevoked:
      return {
        eventName,
        args: {
          orgId: asString(args.orgId),
          mandateId: asString(args.mandateId),
          holderAddress: asAddress(args.holder),
        } satisfies MandateRevokedEventArgsDto,
      };
    case GovernanceEventName.PolicyRuleSet:
      return {
        eventName,
        args: {
          orgId: asString(args.orgId),
          proposalType: toProposalType(args.proposalType),
          version: asString(args.version),
          requiredApprovalBodies: asStringArray(args.requiredApprovalBodies),
          vetoBodies: asStringArray(args.vetoBodies),
          executorBody: asString(args.executorBody),
          timelockSeconds: asString(args.timelockSeconds),
          enabled: Boolean(args.enabled),
        } satisfies PolicyRuleSetEventArgsDto,
      };
    case GovernanceEventName.ProposalCreated:
      return {
        eventName,
        args: {
          orgId: asString(args.orgId),
          proposalId: asString(args.proposalId),
          proposalType: toProposalType(args.proposalType),
          policyVersion: asString(args.policyVersion),
          creatorAddress: asAddress(args.creator),
          targetAddress: asAddress(args.target),
          value: asString(args.value),
          dataHash: asBytes32Hash(args.dataHash),
          metadataUri: asString(args.metadataURI),
        } satisfies ProposalCreatedEventArgsDto,
      };
    case GovernanceEventName.ProposalApproved:
      return {
        eventName,
        args: {
          orgId: asString(args.orgId),
          proposalId: asString(args.proposalId),
          bodyId: asString(args.bodyId),
          actorAddress: asAddress(args.actor),
        } satisfies ProposalApprovedEventArgsDto,
      };
    case GovernanceEventName.ProposalVetoed:
      return {
        eventName,
        args: {
          orgId: asString(args.orgId),
          proposalId: asString(args.proposalId),
          bodyId: asString(args.bodyId),
          actorAddress: asAddress(args.actor),
        } satisfies ProposalVetoedEventArgsDto,
      };
    case GovernanceEventName.ProposalQueued:
      return {
        eventName,
        args: {
          orgId: asString(args.orgId),
          proposalId: asString(args.proposalId),
          queuedAt: asString(args.queuedAt),
          executableAt: asString(args.executableAt),
        } satisfies ProposalQueuedEventArgsDto,
      };
    case GovernanceEventName.ProposalExecuted:
      return {
        eventName,
        args: {
          orgId: asString(args.orgId),
          proposalId: asString(args.proposalId),
          executorAddress: asAddress(args.executor),
          targetAddress: asAddress(args.target),
          dataHash: asBytes32Hash(args.dataHash),
        } satisfies ProposalExecutedEventArgsDto,
      };
    case GovernanceEventName.ProposalCancelled:
      return {
        eventName,
        args: {
          orgId: asString(args.orgId),
          proposalId: asString(args.proposalId),
          actorAddress: asAddress(args.actor),
        } satisfies ProposalCancelledEventArgsDto,
      };
    case GovernanceEventName.ProposalStatusChanged:
      return {
        eventName,
        args: {
          orgId: asString(args.orgId),
          proposalId: asString(args.proposalId),
          previousStatus: toProposalStatus(args.previousStatus),
          newStatus: toProposalStatus(args.newStatus),
        } satisfies ProposalStatusChangedEventArgsDto,
      };
    default:
      return undefined;
  }
}

function isGovernanceEventName(value: string): value is GovernanceEventName {
  return GOVERNANCE_EVENT_NAMES.has(value);
}

export function toBodyKind(value: unknown): BodyKind {
  return enumOrChainValue(value, BodyKind, BODY_KIND_CHAIN_MAP.valuesByCode);
}

export function toOrganizationStatus(value: unknown): OrganizationStatus {
  return enumOrChainValue(
    value,
    OrganizationStatus,
    ORGANIZATION_STATUS_CHAIN_MAP.valuesByCode,
  );
}

export function toProposalStatus(value: unknown): ProposalStatus {
  return enumOrChainValue(
    value,
    ProposalStatus,
    PROPOSAL_STATUS_CHAIN_MAP.valuesByCode,
  );
}

export function toProposalType(value: unknown): ProposalType {
  return enumOrChainValue(
    value,
    ProposalType,
    PROPOSAL_TYPE_CHAIN_MAP.valuesByCode,
  );
}

export function toRoleType(value: unknown): RoleType {
  return enumOrChainValue(value, RoleType, ROLE_TYPE_CHAIN_MAP.valuesByCode);
}

function enumOrChainValue<T extends string>(
  value: unknown,
  enumObject: Readonly<Record<string, T>>,
  valuesByCode: Readonly<Record<number, T>>,
): T {
  if (
    typeof value === 'string' &&
    Object.values(enumObject).includes(value as T)
  ) {
    return value as T;
  }

  const mapped = valuesByCode[Number(asString(value))];
  if (!mapped) {
    throw new Error(`Unsupported governance domain value: ${asString(value)}`);
  }
  return mapped;
}

function asAddress(value: unknown): Address {
  return asString(value).toLowerCase() as Address;
}

function asBytes32Hash(value: unknown): Bytes32Hash {
  return asString(value) as Bytes32Hash;
}
