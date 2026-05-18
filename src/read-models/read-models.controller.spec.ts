import { ReadModelsController } from './read-models.controller';
import { ReadModelsService } from './read-models.service';

describe('ReadModelsController', () => {
  it('returns organization execution permissions from the read-model service', async () => {
    const permissions = {
      orgId: '1',
      targets: [
        {
          orgId: '1',
          targetAddress: '0x0000000000000000000000000000000000000002',
          enabled: true,
          maxValue: '1000',
          selectors: [],
        },
      ],
    };
    const getExecutionPermissions = jest.fn(() => Promise.resolve(permissions));
    const service = {
      getExecutionPermissions,
    } as unknown as ReadModelsService;
    const controller = new ReadModelsController(service);

    await expect(controller.getExecutionPermissions('1')).resolves.toBe(
      permissions,
    );
    expect(getExecutionPermissions).toHaveBeenCalledWith('1');
  });
});
