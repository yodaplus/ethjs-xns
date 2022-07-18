// External Deps
const Eth = require("ethjs-query");
const EthContract = require("ethjs-contract");
const namehash = require("eth-ens-namehash");

// ABIs
const registryAbi = require("./abis/registry.json");
const resolverAbi = require("./abis/resolver.json");

// Map network to known ENS registries
const networkMap = require("./lib/network-map.json");
const emptyHash =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const emptyAddr = "0x0000000000000000000000000000000000000000";

const NotFoundError = new Error("ENS name not defined.");
const BadCharacterError = new Error("Illegal Character for ENS.");

class Ens {
  constructor(opts = {}) {
    const { provider, network } = opts;
    console.log(
      "🚀 ~ file: index.js ~ line 22 ~ Ens ~ constructor ~ network",
      network
    );
    let { registryAddress } = opts;

    // Validations
    if (!provider) {
      throw new Error("The EthJsENS Constructor requires a provider.");
    }

    // Requires EITHER a network or a registryAddress
    if (!network && !registryAddress) {
      throw new Error(
        "The EthJsENS Constructor requires a network or registry address."
      );
    }

    this.provider = provider;
    this.eth = new Eth(this.provider);
    this.contract = new EthContract(this.eth);
    this.namehash = namehash;

    // Link to Registry
    this.Registry = this.contract(registryAbi);
    if (!registryAddress && network) {
      registryAddress = "0x" + networkMap[network]["registry"];
      console.log(
        "🚀 ~ file: index.js ~ line 45 ~ Ens ~ constructor ~ registryAddress",
        registryAddress
      );
    }
    this.registry = this.Registry.at(registryAddress);

    // Create Resolver class
    this.Resolver = this.contract(resolverAbi);
  }

  lookup(name = "") {
    console.log("🚀 ~ file: index.js ~ line 61 ~ Ens ~ lookup ~ name", name);
    return this.getNamehash(name).then((node) => {
      console.log(
        "🚀 ~ file: index.js ~ line 63 ~ Ens ~ returnthis.getNamehash ~ node",
        node
      );
      if (node === emptyHash) {
        return Promise.reject(NotFoundError);
      }
      return this.resolveAddressForNode(node);
    });
  }

  getNamehash(name) {
    try {
      return Promise.resolve(namehash(name));
    } catch (e) {
      return Promise.reject(BadCharacterError);
    }
  }

  getOwner(name = "") {
    return this.getNamehash(name).then((node) => this.getOwnerForNode(node));
  }

  getOwnerForNode(node) {
    if (node === emptyHash) {
      return Promise.reject(NotFoundError);
    }
    return this.registry.owner(node).then((result) => {
      const ownerAddress = result[0];
      if (ownerAddress === emptyAddr) {
        throw NotFoundError;
      }

      return ownerAddress;
    });
  }

  getResolver(name = "") {
    return this.getNamehash(name).then((node) => this.getResolverForNode(node));
  }

  getResolverAddress(name = "") {
    return this.getNamehash(name).then((node) =>
      this.getResolverAddressForNode(node)
    );
  }

  getResolverForNode(node) {
    if (!node.startsWith("0x")) {
      node = `0x${node}`;
    }

    return this.getResolverAddressForNode(node).then((resolverAddress) => {
      return this.Resolver.at(resolverAddress);
    });
  }

  getResolverAddressForNode(node) {
    return this.registry.resolver(node).then((result) => {
      const resolverAddress = result[0];
      console.log(
        "🚀 ~ file: index.js ~ line 123 ~ Ens ~ returnthis.registry.resolver ~ resolverAddress",
        resolverAddress
      );
      if (resolverAddress === emptyAddr) {
        throw NotFoundError;
      }
      return resolverAddress;
    });
  }

  resolveAddressForNode(node) {
    return this.getResolverForNode(node)
      .then((resolver) => {
        console.log(
          "🚀 ~ file: index.js ~ line 130 ~ Ens ~ .then ~ resolver",
          resolver
        );
        return resolver.addr(node);
      })
      .then((result) => result[0]);
  }

  reverse(address) {
    if (!address) {
      return Promise.reject(
        new Error("Must supply an address to reverse lookup.")
      );
    }

    if (address.startsWith("0x")) {
      address = address.slice(2);
    }

    const name = `${address.toLowerCase()}.addr.reverse`;
    const node = namehash(name);
    return this.getNamehash(name)
      .then((node) => this.getResolverForNode(node))
      .then((resolver) => resolver.name(node))
      .then((results) => results[0]);
  }
}

module.exports = Ens;
