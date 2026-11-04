import { data } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";
import { getCompatibleLensIndices } from "./lens-index-compatibility.server";

export async function loadLensIndexCompatibility({
  request,
}: LoaderFunctionArgs) {
  const url = new URL(request.url);

  if (url.searchParams.has("signature")) {
    await authenticate.public.appProxy(request);
  } else {
    await authenticate.admin(request);
  }

  const lensTypeCode = url.searchParams.get("lensTypeCode");
  const lensOptionCode = url.searchParams.get("lensOptionCode");

  if (!lensTypeCode || !lensOptionCode) {
    throw data(
      { error: "lensTypeCode and lensOptionCode are required." },
      { status: 400 },
    );
  }

  const indices = await getCompatibleLensIndices(
    lensTypeCode,
    lensOptionCode,
  );

  return data({ indices });
}
