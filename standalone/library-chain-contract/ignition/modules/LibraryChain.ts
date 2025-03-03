import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";


const LibraryChainModule = buildModule("LibraryChain", (m) => {
  const libraryChain = m.contract("LibraryChain", []);

  return { libraryChain };
});

export default LibraryChainModule;
