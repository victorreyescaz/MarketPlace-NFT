import { Button, HStack, Input, Textarea, VStack } from "@chakra-ui/react";

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

}) {

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

            <HStack>
                <Input 
                type="file" 
                accept="image/*" 
                onChange={(e) => onFileChange(e.target.files?.[0] || null)} 
                />
            </HStack>

            <Button 
            onClick={onMint} 
            colorScheme="blue"
            isDisabled={!isConnected || !file || !name || busy}
            >

            {busy ? "Procesando..." : "Mint NFT"}
            </Button>
        </VStack>
    );
}