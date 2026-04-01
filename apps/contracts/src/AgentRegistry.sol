// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AgentRegistry
 * @notice On-chain identity registry for CrystalFlow agents (ERC-8004 pattern)
 * @dev Each agent gets a unique ID, a role, and a URI pointing to their identity JSON
 */
contract AgentRegistry {
    // Enums
    enum Role {
        Scout,
        Sentinel,
        Curator
    }

    // Structs
    struct Agent {
        uint256 id;
        address owner;
        Role role;
        string name;
        string agentURI;
        uint256 registeredAt;
        bool active;
    }

    // State variables
    mapping(uint256 => Agent) private agents;
    mapping(address => uint256) private agentByOwner;
    uint256[] private agentIds;
    uint256 private agentCounter;

    // Events
    event AgentRegistered(uint256 indexed agentId, address indexed owner, Role role, string name);
    event AgentDeactivated(uint256 indexed agentId);
    event AgentURIUpdated(uint256 indexed agentId, string newURI);

    // Errors
    error AlreadyRegistered();
    error AgentNotFound();
    error NotAgentOwner();
    error EmptyName();

    /**
     * @notice Register a new agent with a role and identity
     * @param role Agent role (Scout, Sentinel, Curator)
     * @param name Human-readable agent name
     * @param agentURI URI pointing to agent identity JSON (ERC-8004 format)
     * @return agentId The unique ID assigned to the agent
     */
    function register(Role role, string calldata name, string calldata agentURI) external returns (uint256 agentId) {
        if (agentByOwner[msg.sender] != 0) revert AlreadyRegistered();
        if (bytes(name).length == 0) revert EmptyName();

        agentCounter++;
        agentId = agentCounter;

        agents[agentId] = Agent({
            id: agentId,
            owner: msg.sender,
            role: role,
            name: name,
            agentURI: agentURI,
            registeredAt: block.timestamp,
            active: true
        });

        agentByOwner[msg.sender] = agentId;
        agentIds.push(agentId);

        emit AgentRegistered(agentId, msg.sender, role, name);
    }

    /**
     * @notice Deactivate an agent
     * @param agentId ID of the agent to deactivate
     */
    function deactivate(uint256 agentId) external {
        Agent storage agent = agents[agentId];
        if (agent.id == 0) revert AgentNotFound();
        if (agent.owner != msg.sender) revert NotAgentOwner();

        agent.active = false;
        emit AgentDeactivated(agentId);
    }

    /**
     * @notice Update an agent's URI
     * @param agentId ID of the agent
     * @param newURI New URI pointing to updated identity JSON
     */
    function updateURI(uint256 agentId, string calldata newURI) external {
        Agent storage agent = agents[agentId];
        if (agent.id == 0) revert AgentNotFound();
        if (agent.owner != msg.sender) revert NotAgentOwner();

        agent.agentURI = newURI;
        emit AgentURIUpdated(agentId, newURI);
    }

    /**
     * @notice Get agent details by ID
     * @param agentId ID of the agent
     * @return Agent struct
     */
    function getAgent(uint256 agentId) external view returns (Agent memory) {
        Agent memory agent = agents[agentId];
        if (agent.id == 0) revert AgentNotFound();
        return agent;
    }

    /**
     * @notice Get agent details by owner address
     * @param owner Address of the agent owner
     * @return Agent struct
     */
    function getAgentByOwner(address owner) external view returns (Agent memory) {
        uint256 agentId = agentByOwner[owner];
        if (agentId == 0) revert AgentNotFound();
        return agents[agentId];
    }

    /**
     * @notice Get total number of registered agents
     * @return Total count
     */
    function getAgentCount() external view returns (uint256) {
        return agentCounter;
    }

    /**
     * @notice Get all agent IDs
     * @return Array of all agent IDs
     */
    function getAllAgentIds() external view returns (uint256[] memory) {
        return agentIds;
    }

    /**
     * @notice Check if an address has an active agent
     * @param addr Address to check
     * @return True if the address has an active agent
     */
    function isActiveAgent(address addr) external view returns (bool) {
        uint256 agentId = agentByOwner[addr];
        if (agentId == 0) return false;
        return agents[agentId].active;
    }
}
