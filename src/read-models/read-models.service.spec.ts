import { ProposalStatus, ProposalType, RouteBlockedReasonCode } from '@isonia/types';
import { DatabaseService } from '../database/database.service';
import { ReadModelsService } from './read-models.service';

describe('ReadModelsService', () => {
  it('reports a missing policy snapshot in proposal route explanations', async () => {
    const db = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('from proposals')) {
          return {
            rows: [
              {
                chain_id: '31337',
                org_id: '1',
                proposal_id: '42',
                proposal_type: ProposalType.Standard,
                policy_version: '7',
                status: ProposalStatus.Approved,
                queued_at_chain: null,
                executable_at_chain: null,
              },
            ],
          };
        }

        return { rows: [] };
      }),
    } as unknown as DatabaseService;
    const service = new ReadModelsService(db);

    const route = await service.getProposalRoute('1', '42');

    expect(route?.execution.executable).toBe(false);
    expect(route?.execution.blockedReasons).toContainEqual({
      code: RouteBlockedReasonCode.PolicySnapshotMissing,
      message: 'Proposal policy snapshot is missing from projections.',
    });
  });
});
