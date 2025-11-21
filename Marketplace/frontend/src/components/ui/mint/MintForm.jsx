/*
Formulario controlado para mintear un NFT, incluyendo nombre, descripción, archivo, toggle de auto-listado y precio opcional.

Al querer Listar de forma automática se puede introducir el input del precio en ETH o en $ y ejecuta la conversión correspondiente
 */

import { useEffect } from "react";
import { Button, HStack, Input, Textarea, VStack, Switch, Text, Heading} from "@chakra-ui/react";
import { DividerLine } from "../common/dividerLine";
import { useEthUsdConversion } from "../../../hooks/useEthUsdConversion";


export default function MintForm({
    name, 
    desc,
    onNameChange,
    onDescChange,
    onFileChange,
    onMint,
    busy,
    isConnected,
    file,
    autoList,
    onToggleList,
    priceEth: priceEthProp,
    onPriceChange,
    defaultPriceDolar,
    defaultPriceEth,

}) {

    const {
        priceEth: convPriceEth,
        priceUsd: priceDolar,
        onChangeEth,
        onChangeUsd,
        } = useEthUsdConversion({
        initialEth: priceEthProp ?? defaultPriceEth ?? "",
        initialUsd: defaultPriceDolar ?? "",
    });

    useEffect(() => {
        onPriceChange?.(convPriceEth);
    }, [convPriceEth, onPriceChange]);

    const needsPrice = autoList && (!convPriceEth || Number(convPriceEth)<=0);


    return(
        
        <>
        <DividerLine />
            <VStack align="stretch" spacing={3}>
                <Heading size={"lg"}>Formulario de Minteo</Heading>

                <Input
                placeholder="Nombre del NFT" 
                value={name} 
                onChange={(e) => onNameChange(e.target.value.slice(0,20))} 
                />

                <Textarea 
                placeholder="Descripción (opcional)" 
                value={desc} 
                onChange={(e) => onDescChange(e.target.value)} 
                />

                <HStack
                alignItems="center"
                justifyContent = "space-between">
                    <Switch.Root
                    id="auto-list"
                    checked={autoList}
                    onCheckedChange={({checked}) => onToggleList(checked)}
                    disabled={busy}
                    >
                        <Switch.HiddenInput />
                        <Switch.Label fontWeight="medium">
                            Listar automáticamente tras mintear
                        </Switch.Label>
                        <Switch.Control>
                            <Switch.Thumb/>
                        </Switch.Control>
                    </Switch.Root>
                </HStack>

                {autoList && (
                    <VStack align="stretch" spacing={2}>
                        <HStack align="stretch" spacing={1}>
                            <Input
                            type="number"
                            min="0"
                            step="0.0001"
                            placeholder="Precio en ETH"
                            value={convPriceEth}
                            onChange={(e) => onChangeEth(e.target.value)}
                            disabled={busy}
                            />
                            <Text display={"flex"} alignItems={"center"} justifyContent={"center"} textAlign={"center"} mr={3}>ETH</Text>

                            
                            <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Precio en USD"
                            value={priceDolar}
                            onChange={(e) => onChangeUsd(e.target.value)}
                            disabled={busy}
                            />
                            <Text display={"flex"} alignItems={"center"} justifyContent={"center"} textAlign={"center"}>$</Text>

                        </HStack>

                        <Text fontSize="sm" color="gray.400">
                            Firmarás dos transacciones: mint y listar
                        </Text>
                    </VStack>
                )}


                <HStack>
                    <Input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => onFileChange(e.target.files?.[0] || null)} 
                    />
                </HStack>

                <Button 
                onClick={onMint} 
                colorPalette="blue"
                disabled={!isConnected || !file || !name || busy || needsPrice}
                >

                {busy ? "Procesando..." : "Mint NFT"}
                </Button>
            </VStack>
        </>
    );
};
