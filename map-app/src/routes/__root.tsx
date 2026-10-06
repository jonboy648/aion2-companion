import {createRootRoute, Outlet, Navigate} from '@tanstack/react-router'
import TopNavbar from "@/components/TopNavbar.tsx";
import {SiteConfigProvider} from "@/context/SiteConfigContext.tsx";
import {DataModeProvider} from "@/hooks/useDataMode.tsx";
import {ThemeProvider} from "@/context/ThemeContext.tsx";
import {HeroUIProvider} from "@heroui/react";
import {GameMapProvider} from "@/context/GameMapContext.tsx";

const NotFoundRedirect = () => {
  return <Navigate to="/" replace/>;
};

const RootLayout = () => (
  <SiteConfigProvider>
    <DataModeProvider>
      <ThemeProvider>
        <GameMapProvider>
          <HeroUIProvider locale="en-US">
            <div className="h-screen w-screen flex flex-col overflow-hidden">
              <TopNavbar />
              <Outlet/>
            </div>
          </HeroUIProvider>
        </GameMapProvider>
      </ThemeProvider>
    </DataModeProvider>
  </SiteConfigProvider>
);

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundRedirect
})
