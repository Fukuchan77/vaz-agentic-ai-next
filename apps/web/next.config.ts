import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// React Compiler auto-memoization (removes the need for manual useMemo/useCallback).
	reactCompiler: true,
};

export default nextConfig;
