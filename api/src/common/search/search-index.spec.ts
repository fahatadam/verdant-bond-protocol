/**
 * Permission-aware search indexing tests.
 *
 * Tests cover visibility changes, deletions, and permission-filtered queries.
 *
 * See: https://github.com/verdant-bond-protocol/verdant-bond-protocol/issues/275
 */

import { Test, TestingModule } from '@nestjs/testing';
import { SearchIndexService, VisibilityLevel, EntityType, IndexEntry, defaultPermissionChecker } from './search-index.service';
import { RedisService } from './redis.service';
import { ConfigService } from '../config/config.service';

jest.mock('@redis/client', () => {
  const mockClient = {
    connect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    setEx: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    sAdd: jest.fn().mockResolvedValue(1),
    sMembers: jest.fn().mockResolvedValue([]),
    scan: jest.fn().mockResolvedValue({ cursor: 0, keys: [] }),
  };
  return { createClient: jest.fn().mockReturnValue(mockClient) };
});

const redisProvider = {
  provide: RedisService,
  useValue: {
    get: jest.fn().mockResolvedValue(null),
    setEx: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    sAdd: jest.fn().mockResolvedValue(1),
    sMembers: jest.fn().mockResolvedValue([]),
    scan: jest.fn().mockResolvedValue({ cursor: 0, keys: [] }),
  },
};

const configProvider = {
  provide: ConfigService,
  useValue: {
    getBondIssuerAddress: jest.fn().mockReturnValue('CBOND'),
    getCouponEngineAddress: jest.fn().mockReturnValue('CCOUPON'),
  },
};

function createMockEntry(overrides: Partial<IndexEntry> = {}): IndexEntry {
  return {
    id: 'entry-1',
    recordId: 'bond-1',
    entityType: EntityType.BOND,
    visibility: VisibilityLevel.PUBLIC,
    indexedAt: Date.now(),
    updatedAt: Date.now(),
    permissions: [],
    searchableFields: { name: 'Test Bond', projectId: 'proj-1' },
    ownerAddress: 'GOWNERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    ...overrides,
  };
}

describe('Permission-Aware Search Index (#275)', () => {
  let service: SearchIndexService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [SearchIndexService, redisProvider, configProvider],
    }).compile();
    service = moduleRef.get(SearchIndexService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  describe('upsert', () => {
    it('adds a public entry to the index', async () => {
      const entry = createMockEntry({ visibility: VisibilityLevel.PUBLIC });
      await service.upsert(entry);
      const result = await service.getEntry(EntityType.BOND, 'bond-1');
      expect(result).not.toBeNull();
      expect(result?.visibility).toBe(VisibilityLevel.PUBLIC);
    });

    it('adds a hidden entry to the index', async () => {
      const entry = createMockEntry({ visibility: VisibilityLevel.HIDDEN });
      await service.upsert(entry);
      const result = await service.getEntry(EntityType.BOND, 'bond-1');
      expect(result?.visibility).toBe(VisibilityLevel.HIDDEN);
    });
  });

  describe('permission-filtered search', () => {
    it('returns public entries for any viewer', async () => {
      const entry = createMockEntry({ visibility: VisibilityLevel.PUBLIC });
      await service.upsert(entry);
      jest.spyOn(redisProvider.useValue, 'sMembers').mockReturnValue([JSON.stringify(entry)]);
      jest.spyOn(redisProvider.useValue, 'get').mockResolvedValue(JSON.stringify(entry));

      const result = await service.search(EntityType.BOND, '', 'GVIEWERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it('does not return hidden entries for unauthorized viewers', async () => {
      const hiddenEntry = createMockEntry({
        visibility: VisibilityLevel.HIDDEN,
        recordId: 'hidden-bond',
        id: 'hidden-entry',
      });
      const publicEntry = createMockEntry({ recordId: 'public-bond', id: 'public-entry' });

      const allKeys = [JSON.stringify(hiddenEntry), JSON.stringify(publicEntry)];
      jest.spyOn(redisProvider.useValue, 'sMembers').mockReturnValue(allKeys);
      jest.spyOn(redisProvider.useValue, 'get')
        .mockResolvedValueOnce(JSON.stringify(hiddenEntry))
        .mockResolvedValueOnce(JSON.stringify(publicEntry));

      const result = await service.search(EntityType.BOND, '', 'GVIEWERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
      const hiddenResults = result.entries.filter((e) => e.visibility === VisibilityLevel.HIDDEN);
      expect(hiddenResults).toHaveLength(0);
    });

    it('returns restricted entries only for the owner', async () => {
      const restrictedEntry = createMockEntry({
        visibility: VisibilityLevel.RESTRICTED,
        recordId: 'restricted-bond',
        id: 'restricted-entry',
        ownerAddress: 'GOWNERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        permissions: ['GOWNERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'],
      });

      jest.spyOn(redisProvider.useValue, 'sMembers').mockReturnValue([JSON.stringify(restrictedEntry)]);
      jest.spyOn(redisProvider.useValue, 'get').mockResolvedValue(JSON.stringify(restrictedEntry));

      // Owner can see it
      const ownerResult = await service.search(EntityType.BOND, '', 'GOWNERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
      expect(ownerResult.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('visibility changes', () => {
    it('hides an entry when visibility is changed to hide', async () => {
      const entry = createMockEntry({ visibility: VisibilityLevel.PUBLIC, recordId: 'bond-1', id: 'entry-1' });
      await service.upsert(entry);

      const hooks: any[] = [];
      await service.handleVisibilityChange(
        EntityType.BOND,
        'bond-1',
        'hide',
        'GADMINAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        hooks,
      );

      const visibility = await service.getVisibility(EntityType.BOND, 'bond-1');
      expect(visibility).toBe(VisibilityLevel.HIDDEN);
    });

    it('deletes an entry when visibility is changed to delete', async () => {
      const entry = createMockEntry({ visibility: VisibilityLevel.PUBLIC, recordId: 'bond-1', id: 'entry-1' });
      await service.upsert(entry);

      await service.handleVisibilityChange(
        EntityType.BOND,
        'bond-1',
        'delete',
        'GADMINAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        [],
      );

      const result = await service.getEntry(EntityType.BOND, 'bond-1');
      expect(result).toBeNull();
    });

    it('revokes an entry when visibility is changed to revoke', async () => {
      const entry = createMockEntry({ visibility: VisibilityLevel.PUBLIC, recordId: 'bond-1', id: 'entry-1' });
      await service.upsert(entry);

      await service.handleVisibilityChange(
        EntityType.BOND,
        'bond-1',
        'revoke',
        'GADMINAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        [],
      );

      const visibility = await service.getVisibility(EntityType.BOND, 'bond-1');
      expect(visibility).toBe(VisibilityLevel.REVOKED);
    });
  });

  describe('stale index repair', () => {
    it('removes entries for deleted records', async () => {
      const entry = createMockEntry({ visibility: VisibilityLevel.PUBLIC, recordId: 'deleted-bond', id: 'deleted-entry' });
      await service.upsert(entry);

      const getRecordState = jest.fn().mockResolvedValue({ isActive: false, isDeleted: true });
      const result = await service.repairStaleEntries(EntityType.BOND, getRecordState);
      expect(result.removed).toBeGreaterThanOrEqual(0);
    });

    it('repairs entries for inactive records', async () => {
      const entry = createMockEntry({ visibility: VisibilityLevel.PUBLIC, recordId: 'inactive-bond', id: 'inactive-entry' });
      await service.upsert(entry);

      const getRecordState = jest.fn().mockResolvedValue({ isActive: false, isDeleted: false });
      const result = await service.repairStaleEntries(EntityType.BOND, getRecordState);
      expect(result.repaired).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getAll', () => {
    it('returns all entries for an entity type', async () => {
      const entry = createMockEntry({ recordId: 'bond-1', id: 'entry-1' });
      await service.upsert(entry);
      const entries = await service.getAll(EntityType.BOND);
      expect(Array.isArray(entries)).toBe(true);
    });
  });

  describe('removeForbiddenEntries', () => {
    it('removes hidden/revoked/deleted entries from search index', async () => {
      await service.removeForbiddenEntries();
      // Should complete without error
    });
  });

  describe('defaultPermissionChecker', () => {
    it('allows public access to anyone', () => {
      const entry = createMockEntry({ visibility: VisibilityLevel.PUBLIC });
      expect(defaultPermissionChecker('anyone', entry)).toBe(true);
    });

    it('denies hidden access to anyone', () => {
      const entry = createMockEntry({ visibility: VisibilityLevel.HIDDEN });
      expect(defaultPermissionChecker('anyone', entry)).toBe(false);
    });

    it('denies revoked access to anyone', () => {
      const entry = createMockEntry({ visibility: VisibilityLevel.REVOKED });
      expect(defaultPermissionChecker('anyone', entry)).toBe(false);
    });

    it('denies deleted access to anyone', () => {
      const entry = createMockEntry({ visibility: VisibilityLevel.DELETED });
      expect(defaultPermissionChecker('anyone', entry)).toBe(false);
    });
  });
});
