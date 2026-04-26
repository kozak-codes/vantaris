import { Container, getContainer } from "@cloudflare/containers";

export class VantarisContainer extends Container {
  defaultPort = 2567;
  sleepAfter = "30m";
  envVars = {
    ALLOWED_ORIGIN: "https://vantaris.gg",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const container = getContainer(env.VANTARIS_CONTAINER);
    return container.fetch(request);
  },
};

interface Env {
  VANTARIS_CONTAINER: DurableObjectNamespace<VantarisContainer>;
}