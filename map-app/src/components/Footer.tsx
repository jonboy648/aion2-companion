import React from 'react';
import {Link} from "@tanstack/react-router";

const Footer: React.FC = () => {
  return (
    <footer className="w-full py-6 px-4 flex flex-col md:flex-row justify-center items-center gap-x-8 gap-y-2 text-default-800 text-[13px] border-t border-crafting-border bg-transparent shrink-0">
      <span>Unofficial fan tool. Code GPL-3.0, data CC BY-NC 4.0.</span>
      <span>Original project by Yihao Liu (tc-imba) and contributors.</span>
      <Link to="/about/" className="hover:text-primary transition-colors">About and credits</Link>
    </footer>
  );
};

export default Footer;
