import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const VISUAL_LOCK_PATH = "contracts/mts-visual-consumer-lock.json";
const CORE_LOCK_PATH = "contracts/mts-core-consumer-lock.json";

function readJson(path: string): Record<string, any> {
  return JSON.parse(readFileSync(path, "utf8"));
}

describe("standalone @mts/visual consumer lock", () => {
  it("pins the exact accepted presentation authority", () => {
    expect(
      existsSync(VISUAL_LOCK_PATH),
      "accepted standalone visual consumer lock must exist",
    ).toBe(true);

    const lock = readJson(VISUAL_LOCK_PATH);
    expect(lock).toEqual({
      schema: "aprover-mts-visual-consumer-lock/v0.1",
      channel: "accepted-presentation",
      repository: "netkeep80/mts_visual",
      commit: "2d76cd29143fa764f4a08d0c0a788ff73c38841c",
      package: {
        root: ".",
        name: "@mts/visual",
        version: "0.2.0",
        private: true,
        manifest: {
          path: "package.json",
          gitBlobSha: "f17a2e119cd1e98110b5a36baa8535a435a03ac1",
        },
        lockfile: {
          path: "package-lock.json",
          gitBlobSha: "3446bedebbd0bbc00b676f97050083d17f02107b",
          lockfileVersion: 3,
        },
        dependencies: {
          three: "0.185.1",
        },
      },
      authority: {
        floatingRefAllowed: false,
        deepSourceImportAllowed: false,
        semanticAcceptanceClaimed: false,
        semanticCoreLockIndependent: true,
      },
    });
  });

  it("keeps visual presentation absent from the trusted application dependency set", () => {
    const project = readJson("package.json");
    const runtimeDependencies = {
      ...(project.dependencies ?? {}),
      ...(project.devDependencies ?? {}),
      ...(project.peerDependencies ?? {}),
      ...(project.optionalDependencies ?? {}),
    };
    expect(runtimeDependencies).not.toHaveProperty("@mts/visual");

    const core = readJson(CORE_LOCK_PATH);
    expect(core.repository).toBe("netkeep80/anum_docs");
    expect(core.commit).toBe("1bc6de1f5c06f46858100807b5fe9191d057c6a2");
    expect(core.package.name).toBe("@mts/core");
    expect(core.package.version).toBe("0.10.0");
  });
});
