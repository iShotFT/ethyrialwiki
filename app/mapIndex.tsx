import { Provider } from "mobx-react";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { HelmetProvider } from "react-helmet-async"; // Import HelmetProvider
import stores from "~/stores";
import MapScene from "~/scenes/Map"; // Import the Map scene
import Analytics from "~/components/Analytics"; // Import Analytics
import ErrorBoundary from "~/components/ErrorBoundary";
import Theme from "~/components/Theme"; // Import Theme provider
import "./styles/tailwind.css"; // Import Tailwind CSS

// Define the expected shape of window.env for the map page
interface MapEnv {
  currentUser: {
    id: string;
    name: string;
    email: string;
    teamId: string;
  } | null;
  handlerConfig?: {
    mapId?: string;
    [key: string]: any;
  } | null;
  // Include other base env properties if needed by map components
  [key: string]: any;
}

const element = document.getElementById("root");

if (element) {
  // Basic App structure for the map page
  const App = () => (
    <React.StrictMode>
      <HelmetProvider>
        <Provider {...stores}>
          <Analytics>
            <Theme>
              <ErrorBoundary showTitle>
                <MapScene />
              </ErrorBoundary>
            </Theme>
          </Analytics>
        </Provider>
      </HelmetProvider>
    </React.StrictMode>
  );

  ReactDOM.render(<App />, element);
}
