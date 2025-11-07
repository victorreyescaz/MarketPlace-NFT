// Sustituto del Divider ya que tenemos problemas para importarlo. El divider renderiza una linea <hr> de HTML

export const DividerLine = (props) => (
  <Box
    as="hr"
    borderTopWidth="1px"
    borderColor="whiteAlpha.300"
    my="4"
    {...props}
  />
);
