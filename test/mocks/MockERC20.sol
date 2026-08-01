// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice ERC-20 minimo para pruebas. No se despliega en produccion.
contract MockERC20 is ERC20 {
    uint8 private immutable _DECIMALS;

    constructor(string memory name_, string memory symbol_, uint8 decimals_)
        ERC20(name_, symbol_)
    {
        _DECIMALS = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _DECIMALS;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Token con comision de transferencia (fee-on-transfer).
/// @dev Existe solo para documentar como se comporta el vesting con
///      tokens que no entregan la cantidad que uno les pide entregar.
contract MockFeeOnTransferERC20 is ERC20 {
    uint256 public constant FEE_BPS = 500; // 5%

    constructor() ERC20("Fee Token", "FEE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0)) {
            super._update(from, to, value);
            return;
        }
        uint256 fee = (value * FEE_BPS) / 10_000;
        super._update(from, to, value - fee);
        super._update(from, address(0xFEE), fee);
    }
}
