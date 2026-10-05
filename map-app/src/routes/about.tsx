import {createFileRoute} from "@tanstack/react-router";
import React from "react";
import Footer from "@/components/Footer.tsx";

const REPO_URL = "https://github.com/aion2-interactive-map/aion2-interactive-map";

const AboutPage: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-8 text-default-800">
        <h1 className="text-2xl font-bold text-primary mb-4">About and credits</h1>

        <p className="mb-4">
          This is an unofficial fan tool for AION 2. It is not affiliated with, endorsed by, or sponsored by the
          game's publishers or developers. AION 2 and its related names, logos and game art belong to their
          respective owners.
        </p>

        <h2 className="text-lg font-bold mt-6 mb-2">Original project</h2>
        <p className="mb-2">
          This copy is based on the AION2 Interactive Map by <strong>Yihao Liu (tc-imba)</strong> and
          contributors, including the Suyn AION2 Team.
        </p>
        <p className="mb-4">
          Source repository:{" "}
          <a className="text-primary underline" href={REPO_URL} target="_blank" rel="noopener noreferrer">
            {REPO_URL}
          </a>
        </p>

        <h2 className="text-lg font-bold mt-6 mb-2">Licenses</h2>
        <ul className="list-disc pl-6 mb-4">
          <li>Source code: GNU General Public License v3.0 (GPL-3.0). See the LICENSE file.</li>
          <li>Data under <code>/public/data</code>: Creative Commons Attribution-NonCommercial 4.0 (CC BY-NC 4.0).</li>
        </ul>
        <p className="mb-4">Copyright (c) 2025 Yihao Liu (tc-imba)</p>

        <h2 className="text-lg font-bold mt-6 mb-2">This copy</h2>
        <p className="mb-4">
          Adapted for Become Cube with an English interface, locally hosted assets and additional exported zones and markers.
          Locations are approximate; a marker does not confirm that a resource or boss is currently present.
        </p>
        <p className="mb-4">
          <a className="text-primary underline" href={`${import.meta.env.BASE_URL}map-source.tar.gz`}>Download this version's source</a>
          {" · "}<a className="text-primary underline" href={`${import.meta.env.BASE_URL}LICENSE`}>GPL-3.0 license</a>
        </p>
        <p className="mb-4">
          This English-only copy runs fully offline from local files. Analytics, advertising, accounts,
          leaderboards, character lookup, the forum and marker submission were removed because they depend on
          the original author's online services.
        </p>
      </main>
      <Footer/>
    </div>
  );
};

export const Route = createFileRoute("/about")({
  component: AboutPage,
});
