import { BigInt, BigDecimal, log } from '@graphprotocol/graph-ts'
import { Pair, Token, Trade } from '../types/schema'

import {
  Swap,
  Pair as PairContract,
} from "../types/BCT_USDC/Pair"

import { ERC20 as ERC20Contract } from '../types/BCT_USDC/ERC20'

import { Address } from '@graphprotocol/graph-ts'
import { BigDecimalZero, BigIntZero } from './utils'

export function getCreateToken(address: Address): Token {
  let token = Token.load(address.toHexString())

  if (token == null) {
    let contract = ERC20Contract.bind(address)

    token = new Token(address.toHexString())
    token.name = contract.name()
    token.symbol = contract.symbol()
    token.decimals = contract.decimals()
    token.save()
  }

  return token as Token
}

export function getCreatePair(address: Address): Pair {
  let pair = Pair.load(address.toHexString())
  
  if (pair == null) {
    let contract = PairContract.bind(address)

    pair = new Pair(address.toHexString())
    pair.token0 = getCreateToken(contract.token0()).id
    pair.token1 = getCreateToken(contract.token1()).id
    pair.save()
  }

  return pair as Pair
}

function toUnits(x: BigInt, decimals: number): BigDecimal {
  let denom = BigInt.fromI32(10).pow(decimals as u8).toBigDecimal()
  return x.toBigDecimal().div(denom)
}

// BCT_USDC
export function handleSwap(event: Swap): void {
  let pair = getCreatePair(event.address)

  let hour_timestamp = BigInt.fromI32(3600) * (event.block.timestamp / BigInt.fromI32(3600)) as BigInt
  
  let price = BigDecimalZero
  let volume = BigDecimalZero
  let token0_decimals = (Token.load(pair.token0) as Token).decimals
  let token1_decimals = (Token.load(pair.token1) as Token).decimals

  if (event.params.amount0In == BigIntZero) {
    price = toUnits(event.params.amount0Out, token0_decimals) / toUnits(event.params.amount1In, token1_decimals)
    volume = toUnits(event.params.amount0Out, token0_decimals)
  } else {
    price = toUnits(event.params.amount0In, token0_decimals) / toUnits(event.params.amount1Out, token1_decimals)
    volume = toUnits(event.params.amount0In, token0_decimals)
  }

  let trade = Trade.load(event.address.toHexString() + "-" + hour_timestamp.toString())
  if (trade == null) {
    trade = new Trade(event.address.toHexString() + "-" + hour_timestamp.toString())
    trade.open = price
    trade.high = price
    trade.low = price
    trade.close = price
    trade.volume = volume
    trade.timestamp = hour_timestamp
    trade.pair = pair.id
    trade.save()
  } else {
    if (trade.high < price) {
      trade.high = price
    }

    if (trade.low > price) {
      trade.low = price
    }
    trade.close = price
    trade.volume = trade.volume + volume
    trade.save()
  }
}