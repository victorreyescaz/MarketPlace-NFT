/*
Formulario controlado para mintear un NFT, incluyendo nombre, descripción, archivo, toggle de auto-listado y precio opcional.
 */

import { Button, HStack, Input, Textarea, VStack, Switch, Text} from "@chakra-ui/react";


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
    priceEth,
    onPriceChange,

}) {

    const needsPrice = autoList && (!priceEth || Number(priceEth)<=0);
    
    return(
    <VStack align="stretch" spacing={3}>
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
            <VStack align="stretch" spacing={1}>
                <Input
                type="number"
                min="0"
                step="0.0001"
                placeholder="Precio en ETH"
                value={priceEth}
                onChange={(e) => onPriceChange(e.target.value)}
                disabled={busy}
                />

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
    );
};

