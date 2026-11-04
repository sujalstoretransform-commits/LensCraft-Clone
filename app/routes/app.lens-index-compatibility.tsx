import type { LoaderFunctionArgs } from "react-router";

import { loadLensIndexCompatibility } from "../services/lens-index-compatibility-loader.server";

export async function loader(args: LoaderFunctionArgs) {
  return loadLensIndexCompatibility(args);
}