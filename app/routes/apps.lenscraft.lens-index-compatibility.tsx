import type { LoaderFunctionArgs } from "react-router";

import { loadLensIndexCompatibility } from "app/services/lens-index-compatibility-loader.server";

export async function loader(args: LoaderFunctionArgs) {
  return loadLensIndexCompatibility(args);
}

export default function LensIndexCompatibilityProxyRoute() {
  return null;
}
