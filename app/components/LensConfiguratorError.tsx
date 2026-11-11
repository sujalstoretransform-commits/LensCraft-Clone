// import { isRouteErrorResponse, useRouteError } from "react-router";

// export default function LensConfiguratorError() {
//   const error = useRouteError();
//   const message =
//     isRouteErrorResponse(error) && typeof error.data === "string"
//       ? error.data
//       : "The lens configurator could not load. Please refresh the page or contact support.";

//   return (
//     <main className="flex min-h-64 items-center justify-center bg-white px-6 py-12">
//       <section
//         aria-labelledby="configurator-error-title"
//         className="max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-center"
//       >
//         <h1
//           id="configurator-error-title"
//           className="text-lg font-semibold text-amber-950"
//         >
//           Unable to load configurator
//         </h1>
//         <p role="alert" className="mt-2 text-sm text-amber-900">
//           {message}
//         </p>
//       </section>
//     </main>
//   );
// }
