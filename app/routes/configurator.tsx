import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import LensConfiguratorPage from "app/components/LensConfiguratorPage";
import { loadLensConfiguratorPage } from "app/services/lens-configurator-page.server";

export async function loader({ request }: LoaderFunctionArgs) {
    return loadLensConfiguratorPage(request);
}

export default function Configurator() {
    const data = useLoaderData<typeof loader>();
    return <LensConfiguratorPage data={data} />;
}