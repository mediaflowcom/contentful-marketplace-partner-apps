import { useId, useState } from "react";
import { Box, Button, Flex, Text } from "@contentful/f36-components";
import * as icons from "@contentful/f36-icons";
import { CopyTextButton } from "./CopyTextButton";
import { styles } from "./MetadataDetails.styles";
import { countFilledFields, getVisibleFields } from "../utils/MetadataView";
import type { MetadataField, MetadataSection as MetadataSectionData } from "../utils/MetadataView";

/**
 * The expandable part at the bottom of the asset card: all metadata of the file grouped into sections
 *
 * @param sections - The result of buildMetadataSections
 */
export const MetadataDetails = ({ sections }: { sections: MetadataSectionData[] }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showEmptyFields, setShowEmptyFields] = useState(false);
    const panelId = useId();
    const { filled, total } = countFilledFields(sections);

    return (
        <>
            <button type="button" className={ styles.toggle } aria-expanded={ isExpanded } aria-controls={ panelId } onClick={ () => setIsExpanded(!isExpanded) }>
                <icons.ChevronRightIcon variant="secondary" className={ `${styles.chevron} ${isExpanded ? styles.chevronExpanded : ""}` } />
                <span>{ isExpanded ? "Hide all metadata" : "Show all metadata" }</span>
                <span className={ styles.filledCount }>{ filled } of { total } fields filled</span>
            </button>
            <Box id={ panelId } hidden={ !isExpanded } padding="spacingM">
                <Button size="small" variant="secondary" className={ styles.emptyFieldsToggle } onClick={ () => setShowEmptyFields(!showEmptyFields) }>
                    { showEmptyFields ? "Hide empty fields" : "Show empty fields" }
                </Button>
                { sections.map(section => <MetadataSection key={ section.id } section={ section } showEmptyFields={ showEmptyFields } />) }
            </Box>
        </>
    );
};

const MetadataSection = ({ section, showEmptyFields }: { section: MetadataSectionData; showEmptyFields: boolean }) => {
    const visibleFields = getVisibleFields(section.fields, showEmptyFields);

    return (
        <Box as="section" marginTop="spacingL">
            <Text as="h4" className={ styles.sectionTitle }>{ section.title }</Text>
            { visibleFields.length ? (
                visibleFields.map(field => <MetadataRow key={ field.id } field={ field } />)
            ) : (
                <Text as="p" className={ styles.missing }>Nothing added in Mediaflow yet</Text>
            )}
        </Box>
    );
};

const MetadataRow = ({ field }: { field: MetadataField }) => {
    return (
        <div className={ styles.row }>
            <Text className={ styles.label }>{ field.label }</Text>
            <MetadataValue field={ field } />
        </div>
    );
};

const MetadataValue = ({ field }: { field: MetadataField }) => {
    if(field.isEmpty) {
        return <Text className={ styles.missing }>Not added in Mediaflow yet</Text>;
    }

    if(field.isTechnical) {
        return (
            <Flex alignItems="center" gap="spacingXs" className={ styles.technicalRow }>
                <Text className={ styles.technicalValue } title={ field.value }>{ field.value }</Text>
                <CopyTextButton text={ field.value } label={ field.label } />
            </Flex>
        );
    }

    return <Text className={ styles.value }>{ field.value }</Text>;
};
