// Runtime Events (ENG-005) — fábricas puras dos quatro eventos previstos.
// Nenhum outro evento. Sem EventBus: a publicação é a porta ShellPort.

import type { CapabilityRequest, CapabilityResponse, Decision, RuntimeEvent } from "../contracts/runtime.ts";

export const decisionCreated = (decision: Decision, timestamp: number): RuntimeEvent =>
  Object.freeze({ type: "DecisionCreated", timestamp, decisionId: decision.id, missionId: decision.missionId, decision });

export const capabilityRequested = (request: CapabilityRequest, timestamp: number): RuntimeEvent =>
  Object.freeze({ type: "CapabilityRequested", timestamp, decisionId: request.decisionId, missionId: request.missionId, request });

export const capabilityCompleted = (request: CapabilityRequest, response: CapabilityResponse, timestamp: number): RuntimeEvent =>
  Object.freeze({ type: "CapabilityCompleted", timestamp, decisionId: request.decisionId, missionId: request.missionId, request, response });

export const capabilityFailed = (request: CapabilityRequest, response: CapabilityResponse, timestamp: number): RuntimeEvent =>
  Object.freeze({ type: "CapabilityFailed", timestamp, decisionId: request.decisionId, missionId: request.missionId, request, response });
