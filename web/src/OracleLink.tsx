import { useQuery } from "@tanstack/react-query";
import { LINKS } from "./config";
import { useRuntime } from "./data";
import type { Stream } from "./domain";
import { External } from "./ui";

/** Intake receipt IDs and oracle UUIDs differ. Resolve through the public intake status,
 * never turn an intake bytes32 into a made-up oracle URL. Core actions do not depend on this API. */
export function OracleRequestLink({
  id,
  stream,
}: {
  id: bigint;
  stream: Stream;
}) {
  const r = useRuntime();
  const receipt = useQuery({
    queryKey: ["oracle-receipt", stream.requestId],
    staleTime: Infinity,
    retry: 1,
    queryFn: async () => {
      // Locate the timestamp on-chain rather than scanning millions of unrelated log blocks.
      let low = r.fromBlock,
        high = await r.client.getBlockNumber();
      const latest = high;
      while (low < high) {
        const middle = (low + high) / 2n;
        const block = await r.client.getBlock({ blockNumber: middle });
        if (block.timestamp < stream.disputedAt) low = middle + 1n;
        else high = middle;
      }
      // Several blocks can share a second. Include a small boundary margin.
      const fromBlock = low > r.fromBlock + 16n ? low - 16n : r.fromBlock;
      const toBlock = low + 256n < latest ? low + 256n : latest;
      const logs = await r.client.getContractEvents({
        address: r.weir.address,
        abi: r.weir.abi,
        eventName: "Disputed",
        args: { id, requestId: stream.requestId },
        fromBlock,
        toBlock,
        strict: true,
      });
      return logs.at(-1)?.transactionHash ?? null;
    },
  });
  const request = useQuery({
    queryKey: ["oracle-job", receipt.data, stream.requestId],
    enabled: !!receipt.data,
    retry: 1,
    staleTime: 15000,
    refetchInterval: (query) => (query.state.data ? false : 15000),
    queryFn: async () => {
      const response = await fetch(
        LINKS.intakeStatus(r.chain.id, receipt.data!),
        { signal: AbortSignal.timeout(10000) },
      );
      if (!response.ok) return null;
      const data = (await response.json()) as {
        entries?: {
          requestId: string;
          admission?: { result?: { kind?: string; jobId?: string } };
        }[];
      };
      const result = data.entries?.find(
        (e) => e.requestId.toLowerCase() === stream.requestId.toLowerCase(),
      )?.admission?.result;
      return result?.kind === "oracle" &&
        result.jobId &&
        /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
          result.jobId,
        )
        ? result.jobId
        : null;
    },
  });
  return (
    <div className="oracle-link">
      <External
        href={
          request.data
            ? LINKS.job(request.data)
            : LINKS.oracle(id, r.weir.address)
        }
      >
        {request.data
          ? "View oracle request"
          : "Find this stream’s oracle request"}
      </External>
      {!request.data && (
        <small className="muted">
          Opens the explorer filtered to this stream. A direct link appears when
          the request is indexed.
        </small>
      )}
    </div>
  );
}
