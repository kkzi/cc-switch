import { useState, useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  streamCheckProvider,
  type StreamCheckResult,
} from "@/lib/api/model-test";
import type { AppId } from "@/lib/api";

interface RecentStreamCheckEntry {
  result: StreamCheckResult;
}

export function useStreamCheck(appId: AppId) {
  useTranslation();
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const [recentResults, setRecentResults] = useState<
    Record<string, RecentStreamCheckEntry>
  >({});
  const queryClient = useQueryClient();
  const clearTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  useEffect(() => {
    const clearTimers = clearTimersRef.current;
    return () => {
      clearTimers.forEach((timer) => clearTimeout(timer));
      clearTimers.clear();
    };
  }, []);

  const checkProvider = useCallback(
    async (
      providerId: string,
      _providerName: string,
    ): Promise<StreamCheckResult | null> => {
      const existingTimer = clearTimersRef.current.get(providerId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        clearTimersRef.current.delete(providerId);
      }
      setRecentResults((prev) => {
        if (!(providerId in prev)) return prev;
        const next = { ...prev };
        delete next[providerId];
        return next;
      });
      setCheckingIds((prev) => new Set(prev).add(providerId));

      try {
        const result = await streamCheckProvider(appId, providerId);
        setRecentResults((prev) => ({
          ...prev,
          [providerId]: { result },
        }));
        const clearTimer = setTimeout(() => {
          setRecentResults((prev) => {
            if (!(providerId in prev)) return prev;
            const next = { ...prev };
            delete next[providerId];
            return next;
          });
          clearTimersRef.current.delete(providerId);
        }, 5000);
        clearTimersRef.current.set(providerId, clearTimer);

        await queryClient.invalidateQueries({
          queryKey: ["providerHealth", providerId, appId],
        });
        await queryClient.invalidateQueries({
          queryKey: ["providers", appId],
        });
        await queryClient.invalidateQueries({
          queryKey: ["proxyStatus"],
        });

        return result;
      } catch {
        return null;
      } finally {
        setCheckingIds((prev) => {
          const next = new Set(prev);
          next.delete(providerId);
          return next;
        });
      }
    },
    [appId, queryClient],
  );

  const isChecking = useCallback(
    (providerId: string) => checkingIds.has(providerId),
    [checkingIds],
  );

  const getRecentResult = useCallback(
    (providerId: string) => recentResults[providerId]?.result ?? null,
    [recentResults],
  );

  return { checkProvider, isChecking, getRecentResult };
}
