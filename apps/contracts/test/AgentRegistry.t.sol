// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/AgentRegistry.sol";

contract AgentRegistryTest is Test {
    AgentRegistry public registry;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        registry = new AgentRegistry();
    }

    // ── Registration ──

    function test_register_scout() public {
        vm.prank(alice);
        uint256 agentId = registry.register(AgentRegistry.Role.Scout, "AliceScout", "ipfs://alice");

        assertEq(agentId, 1);
        assertEq(registry.getAgentCount(), 1);

        AgentRegistry.Agent memory agent = registry.getAgent(agentId);
        assertEq(agent.owner, alice);
        assertEq(uint8(agent.role), uint8(AgentRegistry.Role.Scout));
        assertEq(agent.name, "AliceScout");
        assertEq(agent.agentURI, "ipfs://alice");
        assertTrue(agent.active);
    }

    function test_register_multiple_agents() public {
        vm.prank(alice);
        registry.register(AgentRegistry.Role.Scout, "AliceScout", "ipfs://a");

        vm.prank(bob);
        registry.register(AgentRegistry.Role.Sentinel, "BobSentinel", "ipfs://b");

        assertEq(registry.getAgentCount(), 2);

        uint256[] memory ids = registry.getAllAgentIds();
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);
    }

    function test_register_allRoles() public {
        address curator = makeAddr("curator");

        vm.prank(alice);
        registry.register(AgentRegistry.Role.Scout, "Scout", "");

        vm.prank(bob);
        registry.register(AgentRegistry.Role.Sentinel, "Sentinel", "");

        vm.prank(curator);
        registry.register(AgentRegistry.Role.Curator, "Curator", "");

        assertEq(uint8(registry.getAgent(1).role), uint8(AgentRegistry.Role.Scout));
        assertEq(uint8(registry.getAgent(2).role), uint8(AgentRegistry.Role.Sentinel));
        assertEq(uint8(registry.getAgent(3).role), uint8(AgentRegistry.Role.Curator));
    }

    function test_getAgentByOwner() public {
        vm.prank(alice);
        registry.register(AgentRegistry.Role.Scout, "AliceScout", "ipfs://a");

        AgentRegistry.Agent memory agent = registry.getAgentByOwner(alice);
        assertEq(agent.name, "AliceScout");
        assertEq(agent.owner, alice);
    }

    function test_isActiveAgent() public {
        assertFalse(registry.isActiveAgent(alice));

        vm.prank(alice);
        registry.register(AgentRegistry.Role.Scout, "AliceScout", "");

        assertTrue(registry.isActiveAgent(alice));
    }

    // ── Deactivate ──

    function test_deactivate() public {
        vm.prank(alice);
        uint256 agentId = registry.register(AgentRegistry.Role.Scout, "AliceScout", "");

        assertTrue(registry.isActiveAgent(alice));

        vm.prank(alice);
        registry.deactivate(agentId);

        assertFalse(registry.isActiveAgent(alice));

        AgentRegistry.Agent memory agent = registry.getAgent(agentId);
        assertFalse(agent.active);
    }

    function testRevert_deactivate_notOwner() public {
        vm.prank(alice);
        uint256 agentId = registry.register(AgentRegistry.Role.Scout, "AliceScout", "");

        vm.prank(bob);
        vm.expectRevert(AgentRegistry.NotAgentOwner.selector);
        registry.deactivate(agentId);
    }

    function testRevert_deactivate_notFound() public {
        vm.prank(alice);
        vm.expectRevert(AgentRegistry.AgentNotFound.selector);
        registry.deactivate(999);
    }

    // ── Update URI ──

    function test_updateURI() public {
        vm.prank(alice);
        uint256 agentId = registry.register(AgentRegistry.Role.Scout, "AliceScout", "ipfs://old");

        vm.prank(alice);
        registry.updateURI(agentId, "ipfs://new");

        AgentRegistry.Agent memory agent = registry.getAgent(agentId);
        assertEq(agent.agentURI, "ipfs://new");
    }

    function testRevert_updateURI_notOwner() public {
        vm.prank(alice);
        uint256 agentId = registry.register(AgentRegistry.Role.Scout, "AliceScout", "ipfs://old");

        vm.prank(bob);
        vm.expectRevert(AgentRegistry.NotAgentOwner.selector);
        registry.updateURI(agentId, "ipfs://hacked");
    }

    function testRevert_updateURI_notFound() public {
        vm.prank(alice);
        vm.expectRevert(AgentRegistry.AgentNotFound.selector);
        registry.updateURI(999, "ipfs://none");
    }

    // ── Duplicate registration ──

    function testRevert_register_duplicate() public {
        vm.prank(alice);
        registry.register(AgentRegistry.Role.Scout, "AliceScout", "");

        vm.prank(alice);
        vm.expectRevert(AgentRegistry.AlreadyRegistered.selector);
        registry.register(AgentRegistry.Role.Sentinel, "AliceV2", "");
    }

    // ── Empty name ──

    function testRevert_register_emptyName() public {
        vm.prank(alice);
        vm.expectRevert(AgentRegistry.EmptyName.selector);
        registry.register(AgentRegistry.Role.Scout, "", "ipfs://x");
    }

    // ── View reverts ──

    function testRevert_getAgent_notFound() public {
        vm.expectRevert(AgentRegistry.AgentNotFound.selector);
        registry.getAgent(42);
    }

    function testRevert_getAgentByOwner_notFound() public {
        vm.expectRevert(AgentRegistry.AgentNotFound.selector);
        registry.getAgentByOwner(alice);
    }
}
