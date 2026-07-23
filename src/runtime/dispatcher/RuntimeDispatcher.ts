// RuntimeDispatcher (ENG-005) — recebe Decision, despacha pela CapabilityPort e
// publica os eventos de capacidade pela ShellPort. NUNCA conhece a Capability
// concreta (só a porta). DI: capability, shell e relógio injetados.

import type { CapabilityRequest, Decision } from "../contracts/runtime.ts";
import type { CapabilityPort } from "../ports/CapabilityPort.ts";
import type { ShellPort } from "../ports/ShellPort.ts";
import { capabilityRequested, capabilityCompleted, capabilityFailed } from "../events/runtime-events.ts";

export class RuntimeDispatcher {
  constructor(
    private readonly capability: CapabilityPort,
    private readonly shell: ShellPort,
    private readonly now: () => number = Date.now,
  ) {}

  async dispatch(decision: Decision): Promise<void> {
    const request: CapabilityRequest = {
      decisionId: decision.id,
      missionId: decision.missionId,
      payload: decision.payload,
    };
    this.shell.publish(capabilityRequested(request, this.now()));
    try {
      const response = await this.capability.execute(request);
      this.shell.publish(
        response.status === "completed"
          ? capabilityCompleted(request, response, this.now())
          : capabilityFailed(request, response, this.now()),
      );
    } catch (error) {
      this.shell.publish(capabilityFailed(request, { status: "failed", detail: String(error) }, this.now()));
    }
  }
}
