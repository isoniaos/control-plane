import { GovernanceEventName } from '@isonia/types';
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
});
