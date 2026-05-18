import { GovernanceEventName, ProposalType } from '@isonia/types';
import { encodeEventTopics } from 'viem';
import { ISONIA_EVENT_ABI } from './isonia-abi';
import { normalizeDecodedGovernanceLog } from './governance-events';

describe('governance event decoding', () => {
  it('normalizes OrganizationFinalized event args', () => {
    const decoded = normalizeDecodedGovernanceLog(
      GovernanceEventName.OrganizationFinalized,
      {
        orgId: 1n,
        admin: '0x000000000000000000000000000000000000000A',
      },
    );

    expect(decoded).toEqual({
      eventName: GovernanceEventName.OrganizationFinalized,
      args: {
        orgId: '1',
        admin: '0x000000000000000000000000000000000000000a',
      },
    });
  });

  it('includes the OrganizationFinalized event in the indexed ABI', () => {
    const topics = encodeEventTopics({
      abi: ISONIA_EVENT_ABI,
      eventName: GovernanceEventName.OrganizationFinalized,
      args: {
        orgId: 1n,
        admin: '0x000000000000000000000000000000000000000a',
      },
    });

    expect(topics).toHaveLength(3);
  });

  it('normalizes ExecutionTargetRuleUpdated event args', () => {
    const decoded = normalizeDecodedGovernanceLog(
      GovernanceEventName.ExecutionTargetRuleUpdated,
      {
        orgId: 1n,
        target: '0x00000000000000000000000000000000000000AA',
        enabled: true,
        maxValue: 1000n,
        actor: '0x00000000000000000000000000000000000000BB',
      },
    );

    expect(decoded).toEqual({
      eventName: GovernanceEventName.ExecutionTargetRuleUpdated,
      args: {
        orgId: '1',
        targetAddress: '0x00000000000000000000000000000000000000aa',
        enabled: true,
        maxValue: '1000',
        actorAddress: '0x00000000000000000000000000000000000000bb',
      },
    });
  });

  it('normalizes ExecutionSelectorRuleUpdated event args', () => {
    const decoded = normalizeDecodedGovernanceLog(
      GovernanceEventName.ExecutionSelectorRuleUpdated,
      {
        orgId: 1n,
        target: '0x00000000000000000000000000000000000000AA',
        selector: '0xA9059CBB',
        enabled: false,
        actor: '0x00000000000000000000000000000000000000BB',
      },
    );

    expect(decoded).toEqual({
      eventName: GovernanceEventName.ExecutionSelectorRuleUpdated,
      args: {
        orgId: '1',
        targetAddress: '0x00000000000000000000000000000000000000aa',
        selector: '0xa9059cbb',
        enabled: false,
        actorAddress: '0x00000000000000000000000000000000000000bb',
      },
    });
  });

  it('includes execution permission registry events in the indexed ABI', () => {
    const targetTopics = encodeEventTopics({
      abi: ISONIA_EVENT_ABI,
      eventName: GovernanceEventName.ExecutionTargetRuleUpdated,
      args: {
        orgId: 1n,
        target: '0x00000000000000000000000000000000000000aa',
        actor: '0x00000000000000000000000000000000000000bb',
      },
    });
    const selectorTopics = encodeEventTopics({
      abi: ISONIA_EVENT_ABI,
      eventName: GovernanceEventName.ExecutionSelectorRuleUpdated,
      args: {
        orgId: 1n,
        target: '0x00000000000000000000000000000000000000aa',
      },
    });

    expect(targetTopics).toHaveLength(4);
    expect(selectorTopics).toHaveLength(3);
  });

  it('normalizes ProposalCreated event args with actionSelector', () => {
    const decoded = normalizeDecodedGovernanceLog(
      GovernanceEventName.ProposalCreated,
      {
        orgId: 1n,
        proposalId: 42n,
        proposalType: 1,
        policyVersion: 7n,
        creator: '0x000000000000000000000000000000000000000A',
        target: '0x00000000000000000000000000000000000000BB',
        value: 1000n,
        actionSelector: '0xA9059CBB',
        dataHash:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        metadataURI: 'ipfs://proposal',
      },
    );

    expect(decoded).toEqual({
      eventName: GovernanceEventName.ProposalCreated,
      args: {
        orgId: '1',
        proposalId: '42',
        proposalType: ProposalType.Standard,
        policyVersion: '7',
        creatorAddress: '0x000000000000000000000000000000000000000a',
        targetAddress: '0x00000000000000000000000000000000000000bb',
        value: '1000',
        actionSelector: '0xa9059cbb',
        dataHash:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        metadataUri: 'ipfs://proposal',
      },
    });
  });

  it('includes actionSelector in the ProposalCreated indexed ABI shape', () => {
    const event = ISONIA_EVENT_ABI.find(
      (entry) => entry.name === 'ProposalCreated',
    );

    expect(event?.inputs.map((input) => input.name)).toEqual([
      'orgId',
      'proposalId',
      'proposalType',
      'policyVersion',
      'creator',
      'target',
      'value',
      'actionSelector',
      'dataHash',
      'metadataURI',
    ]);
  });

  it('does not normalize arbitrary target-contract events without an adapter', () => {
    expect(
      normalizeDecodedGovernanceLog('TargetProofObserved', {
        orgId: 1n,
        amount: 123n,
      }),
    ).toBeUndefined();
  });
});
