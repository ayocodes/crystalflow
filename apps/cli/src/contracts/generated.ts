//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// AgentRegistry
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const agentRegistryAbi = [
  {
    type: 'function',
    inputs: [{ name: 'agentId', internalType: 'uint256', type: 'uint256' }],
    name: 'deactivate',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'agentId', internalType: 'uint256', type: 'uint256' }],
    name: 'getAgent',
    outputs: [
      {
        name: '',
        internalType: 'struct AgentRegistry.Agent',
        type: 'tuple',
        components: [
          { name: 'id', internalType: 'uint256', type: 'uint256' },
          { name: 'owner', internalType: 'address', type: 'address' },
          { name: 'role', internalType: 'enum AgentRegistry.Role', type: 'uint8' },
          { name: 'name', internalType: 'string', type: 'string' },
          { name: 'agentURI', internalType: 'string', type: 'string' },
          { name: 'registeredAt', internalType: 'uint256', type: 'uint256' },
          { name: 'active', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'owner', internalType: 'address', type: 'address' }],
    name: 'getAgentByOwner',
    outputs: [
      {
        name: '',
        internalType: 'struct AgentRegistry.Agent',
        type: 'tuple',
        components: [
          { name: 'id', internalType: 'uint256', type: 'uint256' },
          { name: 'owner', internalType: 'address', type: 'address' },
          { name: 'role', internalType: 'enum AgentRegistry.Role', type: 'uint8' },
          { name: 'name', internalType: 'string', type: 'string' },
          { name: 'agentURI', internalType: 'string', type: 'string' },
          { name: 'registeredAt', internalType: 'uint256', type: 'uint256' },
          { name: 'active', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getAgentCount',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getAllAgentIds',
    outputs: [{ name: '', internalType: 'uint256[]', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'addr', internalType: 'address', type: 'address' }],
    name: 'isActiveAgent',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'role', internalType: 'enum AgentRegistry.Role', type: 'uint8' },
      { name: 'name', internalType: 'string', type: 'string' },
      { name: 'agentURI', internalType: 'string', type: 'string' },
    ],
    name: 'register',
    outputs: [{ name: 'agentId', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'agentId', internalType: 'uint256', type: 'uint256' },
      { name: 'newURI', internalType: 'string', type: 'string' },
    ],
    name: 'updateURI',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [{ name: 'agentId', internalType: 'uint256', type: 'uint256', indexed: true }],
    name: 'AgentDeactivated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'agentId', internalType: 'uint256', type: 'uint256', indexed: true },
      { name: 'owner', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'role',
        internalType: 'enum AgentRegistry.Role',
        type: 'uint8',
        indexed: false,
      },
      { name: 'name', internalType: 'string', type: 'string', indexed: false },
    ],
    name: 'AgentRegistered',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'agentId', internalType: 'uint256', type: 'uint256', indexed: true },
      { name: 'newURI', internalType: 'string', type: 'string', indexed: false },
    ],
    name: 'AgentURIUpdated',
  },
  { type: 'error', inputs: [], name: 'AgentNotFound' },
  { type: 'error', inputs: [], name: 'AlreadyRegistered' },
  { type: 'error', inputs: [], name: 'EmptyName' },
  { type: 'error', inputs: [], name: 'NotAgentOwner' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// PointsRegistry
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const pointsRegistryAbi = [
  {
    type: 'constructor',
    inputs: [{ name: '_owner', internalType: 'address', type: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'user', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'awardPoints',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    name: 'burnPoints',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'convictionRegistry',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'agents', internalType: 'address[]', type: 'address[]' },
      { name: 'amounts', internalType: 'uint256[]', type: 'uint256[]' },
    ],
    name: 'distributeRewards',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'user', internalType: 'address', type: 'address' }],
    name: 'getPoints',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getTotalBurned',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'predictionMarket',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: '_videoRegistry', internalType: 'address', type: 'address' },
      { name: '_predictionMarket', internalType: 'address', type: 'address' },
      { name: '_convictionRegistry', internalType: 'address', type: 'address' },
    ],
    name: 'setContracts',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'totalBurned',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'videoRegistry',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'videoRegistry', internalType: 'address', type: 'address', indexed: false },
      {
        name: 'predictionMarket',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'convictionRegistry',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'ContractsSet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'user', internalType: 'address', type: 'address', indexed: true },
      { name: 'amount', internalType: 'uint256', type: 'uint256', indexed: false },
      { name: 'reason', internalType: 'string', type: 'string', indexed: false },
    ],
    name: 'PointsAwarded',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256', indexed: false }],
    name: 'PointsBurned',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'agents', internalType: 'address[]', type: 'address[]', indexed: false },
      { name: 'amounts', internalType: 'uint256[]', type: 'uint256[]', indexed: false },
    ],
    name: 'RewardsDistributed',
  },
  { type: 'error', inputs: [], name: 'InvalidAddress' },
  { type: 'error', inputs: [], name: 'LengthMismatch' },
  { type: 'error', inputs: [], name: 'Unauthorized' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// PredictionMarket
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const predictionMarketAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: '_pointsRegistry', internalType: 'address', type: 'address' },
      { name: '_agentRegistry', internalType: 'address', type: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'MARKET_DURATION',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'MAX_STORED_ACTIVITIES',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'WINNER_POINTS',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'agentRegistry',
    outputs: [{ name: '', internalType: 'contract AgentRegistry', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'marketId', internalType: 'string', type: 'string' }],
    name: 'closeMarket',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'videoId', internalType: 'string', type: 'string' },
      { name: 'question', internalType: 'string', type: 'string' },
    ],
    name: 'createMarket',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getActivityCount',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getAllActivities',
    outputs: [
      {
        name: '',
        internalType: 'struct PredictionMarket.Activity[]',
        type: 'tuple[]',
        components: [
          {
            name: 'activityType',
            internalType: 'enum PredictionMarket.ActivityType',
            type: 'uint8',
          },
          { name: 'user', internalType: 'address', type: 'address' },
          { name: 'marketId', internalType: 'string', type: 'string' },
          { name: 'isYes', internalType: 'bool', type: 'bool' },
          { name: 'timestamp', internalType: 'uint256', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getAllMarketIds',
    outputs: [{ name: '', internalType: 'string[]', type: 'string[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'marketId', internalType: 'string', type: 'string' }],
    name: 'getMarket',
    outputs: [
      {
        name: '',
        internalType: 'struct PredictionMarket.Market',
        type: 'tuple',
        components: [
          { name: 'id', internalType: 'string', type: 'string' },
          { name: 'videoId', internalType: 'string', type: 'string' },
          { name: 'question', internalType: 'string', type: 'string' },
          { name: 'creator', internalType: 'address', type: 'address' },
          { name: 'createdAt', internalType: 'uint256', type: 'uint256' },
          { name: 'expiresAt', internalType: 'uint256', type: 'uint256' },
          { name: 'yesVotes', internalType: 'uint256', type: 'uint256' },
          { name: 'noVotes', internalType: 'uint256', type: 'uint256' },
          { name: 'resolved', internalType: 'bool', type: 'bool' },
          { name: 'winningSide', internalType: 'bool', type: 'bool' },
          {
            name: 'status',
            internalType: 'enum PredictionMarket.MarketStatus',
            type: 'uint8',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'marketId', internalType: 'string', type: 'string' }],
    name: 'getMarketActivities',
    outputs: [
      {
        name: '',
        internalType: 'struct PredictionMarket.Activity[]',
        type: 'tuple[]',
        components: [
          {
            name: 'activityType',
            internalType: 'enum PredictionMarket.ActivityType',
            type: 'uint8',
          },
          { name: 'user', internalType: 'address', type: 'address' },
          { name: 'marketId', internalType: 'string', type: 'string' },
          { name: 'isYes', internalType: 'bool', type: 'bool' },
          { name: 'timestamp', internalType: 'uint256', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getMarketCount',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'marketId', internalType: 'string', type: 'string' }],
    name: 'getMarketOdds',
    outputs: [
      { name: 'yesPercentage', internalType: 'uint256', type: 'uint256' },
      { name: 'noPercentage', internalType: 'uint256', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'marketId', internalType: 'string', type: 'string' }],
    name: 'getMarketVoters',
    outputs: [{ name: '', internalType: 'address[]', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'marketId', internalType: 'string', type: 'string' },
      { name: 'user', internalType: 'address', type: 'address' },
    ],
    name: 'getPosition',
    outputs: [
      {
        name: '',
        internalType: 'struct PredictionMarket.Position',
        type: 'tuple',
        components: [
          { name: 'yesVotes', internalType: 'uint256', type: 'uint256' },
          { name: 'noVotes', internalType: 'uint256', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'count', internalType: 'uint256', type: 'uint256' }],
    name: 'getRecentActivities',
    outputs: [
      {
        name: '',
        internalType: 'struct PredictionMarket.Activity[]',
        type: 'tuple[]',
        components: [
          {
            name: 'activityType',
            internalType: 'enum PredictionMarket.ActivityType',
            type: 'uint8',
          },
          { name: 'user', internalType: 'address', type: 'address' },
          { name: 'marketId', internalType: 'string', type: 'string' },
          { name: 'isYes', internalType: 'bool', type: 'bool' },
          { name: 'timestamp', internalType: 'uint256', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'marketId', internalType: 'string', type: 'string' }],
    name: 'isMarketExpired',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'pointsRegistry',
    outputs: [{ name: '', internalType: 'contract PointsRegistry', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'marketId', internalType: 'string', type: 'string' },
      { name: 'winningSide', internalType: 'bool', type: 'bool' },
    ],
    name: 'resolveMarket',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'marketId', internalType: 'string', type: 'string' }],
    name: 'voteNo',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'marketId', internalType: 'string', type: 'string' }],
    name: 'voteYes',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [{ name: 'marketId', internalType: 'string', type: 'string', indexed: true }],
    name: 'MarketClosed',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'marketId', internalType: 'string', type: 'string', indexed: true },
      { name: 'videoId', internalType: 'string', type: 'string', indexed: true },
      { name: 'question', internalType: 'string', type: 'string', indexed: false },
      { name: 'creator', internalType: 'address', type: 'address', indexed: true },
      { name: 'expiresAt', internalType: 'uint256', type: 'uint256', indexed: false },
    ],
    name: 'MarketCreated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'marketId', internalType: 'string', type: 'string', indexed: true },
      { name: 'winningSide', internalType: 'bool', type: 'bool', indexed: false },
      { name: 'yesVotes', internalType: 'uint256', type: 'uint256', indexed: false },
      { name: 'noVotes', internalType: 'uint256', type: 'uint256', indexed: false },
    ],
    name: 'MarketResolved',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'marketId', internalType: 'string', type: 'string', indexed: true },
      { name: 'voter', internalType: 'address', type: 'address', indexed: true },
      { name: 'isYes', internalType: 'bool', type: 'bool', indexed: false },
      { name: 'amount', internalType: 'uint256', type: 'uint256', indexed: false },
    ],
    name: 'VoteCast',
  },
  { type: 'error', inputs: [], name: 'EmptyQuestion' },
  { type: 'error', inputs: [], name: 'EmptyVideoId' },
  { type: 'error', inputs: [], name: 'InvalidVoteAmount' },
  { type: 'error', inputs: [], name: 'MarketAlreadyResolved' },
  { type: 'error', inputs: [], name: 'MarketExpired' },
  { type: 'error', inputs: [], name: 'MarketNotExpired' },
  { type: 'error', inputs: [], name: 'MarketNotFound' },
  { type: 'error', inputs: [], name: 'NotActiveAgent' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// VideoRegistry
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const videoRegistryAbi = [
  {
    type: 'constructor',
    inputs: [{ name: '_pointsRegistry', internalType: 'address', type: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'CONVICTION_PERIOD',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'UPLOAD_POINTS',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'videoId', internalType: 'string', type: 'string' },
      { name: 'convictionIndex', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'dismissConviction',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'videoId', internalType: 'string', type: 'string' }],
    name: 'finalizeVideo',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getAllVideoIds',
    outputs: [{ name: '', internalType: 'string[]', type: 'string[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'videoId', internalType: 'string', type: 'string' },
      { name: 'convictionIndex', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'getConviction',
    outputs: [
      {
        name: '',
        internalType: 'struct VideoRegistry.Conviction',
        type: 'tuple',
        components: [
          { name: 'challenger', internalType: 'address', type: 'address' },
          { name: 'proofCid', internalType: 'string', type: 'string' },
          { name: 'timestamp', internalType: 'uint256', type: 'uint256' },
          {
            name: 'status',
            internalType: 'enum VideoRegistry.ConvictionStatus',
            type: 'uint8',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'videoId', internalType: 'string', type: 'string' }],
    name: 'getConvictionCount',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'videoId', internalType: 'string', type: 'string' }],
    name: 'getVideo',
    outputs: [
      {
        name: '',
        internalType: 'struct VideoRegistry.VideoIndex',
        type: 'tuple',
        components: [
          { name: 'id', internalType: 'string', type: 'string' },
          { name: 'storageCid', internalType: 'string', type: 'string' },
          { name: 'uploader', internalType: 'address', type: 'address' },
          { name: 'indexer', internalType: 'address', type: 'address' },
          { name: 'uploadTime', internalType: 'uint256', type: 'uint256' },
          { name: 'convictionPeriodEnd', internalType: 'uint256', type: 'uint256' },
          { name: 'status', internalType: 'enum VideoRegistry.VideoStatus', type: 'uint8' },
          {
            name: 'convictions',
            internalType: 'struct VideoRegistry.Conviction[]',
            type: 'tuple[]',
            components: [
              { name: 'challenger', internalType: 'address', type: 'address' },
              { name: 'proofCid', internalType: 'string', type: 'string' },
              { name: 'timestamp', internalType: 'uint256', type: 'uint256' },
              {
                name: 'status',
                internalType: 'enum VideoRegistry.ConvictionStatus',
                type: 'uint8',
              },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getVideoCount',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'videoId', internalType: 'string', type: 'string' }],
    name: 'isInConvictionPeriod',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'pointsRegistry',
    outputs: [{ name: '', internalType: 'contract PointsRegistry', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'videoId', internalType: 'string', type: 'string' },
      { name: 'convictionIndex', internalType: 'uint256', type: 'uint256' },
      { name: 'upheld', internalType: 'bool', type: 'bool' },
    ],
    name: 'resolveConviction',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'videoId', internalType: 'string', type: 'string' },
      { name: 'proofCid', internalType: 'string', type: 'string' },
    ],
    name: 'submitConviction',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'videoId', internalType: 'string', type: 'string' },
      { name: 'storageCid', internalType: 'string', type: 'string' },
    ],
    name: 'submitIndex',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'videoId', internalType: 'string', type: 'string', indexed: true },
      { name: 'convictionIndex', internalType: 'uint256', type: 'uint256', indexed: false },
    ],
    name: 'ConvictionDismissed',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'videoId', internalType: 'string', type: 'string', indexed: true },
      { name: 'convictionIndex', internalType: 'uint256', type: 'uint256', indexed: false },
      { name: 'upheld', internalType: 'bool', type: 'bool', indexed: false },
    ],
    name: 'ConvictionResolved',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'videoId', internalType: 'string', type: 'string', indexed: true },
      { name: 'convictionIndex', internalType: 'uint256', type: 'uint256', indexed: false },
      { name: 'challenger', internalType: 'address', type: 'address', indexed: true },
      { name: 'proofCid', internalType: 'string', type: 'string', indexed: false },
      { name: 'timestamp', internalType: 'uint256', type: 'uint256', indexed: false },
    ],
    name: 'ConvictionSubmitted',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [{ name: 'videoId', internalType: 'string', type: 'string', indexed: true }],
    name: 'VideoChallenged',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [{ name: 'videoId', internalType: 'string', type: 'string', indexed: true }],
    name: 'VideoFinalized',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'videoId', internalType: 'string', type: 'string', indexed: true },
      { name: 'uploader', internalType: 'address', type: 'address', indexed: true },
      { name: 'indexer', internalType: 'address', type: 'address', indexed: true },
      { name: 'storageCid', internalType: 'string', type: 'string', indexed: false },
      { name: 'uploadTime', internalType: 'uint256', type: 'uint256', indexed: false },
      {
        name: 'convictionPeriodEnd',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'VideoIndexed',
  },
  { type: 'error', inputs: [], name: 'ConvictionNotFound' },
  { type: 'error', inputs: [], name: 'ConvictionPeriodActive' },
  { type: 'error', inputs: [], name: 'ConvictionPeriodEnded' },
  { type: 'error', inputs: [], name: 'EmptyCid' },
  { type: 'error', inputs: [], name: 'EmptyVideoId' },
  { type: 'error', inputs: [], name: 'InvalidStatus' },
  { type: 'error', inputs: [], name: 'Unauthorized' },
  { type: 'error', inputs: [], name: 'VideoAlreadyExists' },
  { type: 'error', inputs: [], name: 'VideoNotFound' },
] as const
