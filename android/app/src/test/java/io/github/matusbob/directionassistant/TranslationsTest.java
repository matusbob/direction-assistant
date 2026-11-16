package io.github.matusbob.directionassistant;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.io.File;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.xml.parsers.DocumentBuilderFactory;

import org.junit.Test;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

/** Every English text has a Slovak one with the same placeholders, and the other way round. */
public class TranslationsTest {
    private static Map<String, String> load(String dir) throws Exception {
        File f = new File("src/main/res/" + dir + "/strings.xml");
        Document doc = DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(f);
        Map<String, String> out = new TreeMap<>();
        NodeList strings = doc.getElementsByTagName("string");
        for (int i = 0; i < strings.getLength(); i++) {
            Element e = (Element) strings.item(i);
            if ("false".equals(e.getAttribute("translatable"))) continue;
            out.put(e.getAttribute("name"), e.getTextContent());
        }
        NodeList plurals = doc.getElementsByTagName("plurals");
        for (int i = 0; i < plurals.getLength(); i++) {
            Element e = (Element) plurals.item(i);
            out.put("plurals:" + e.getAttribute("name"), e.getElementsByTagName("item").item(0).getTextContent());
        }
        return out;
    }

    private static String placeholders(String s) {
        Matcher m = Pattern.compile("%\\d\\$[sd]").matcher(s);
        StringBuilder b = new StringBuilder();
        while (m.find()) b.append(m.group()).append(' ');
        return b.toString();
    }

    @Test
    public void slovakAndEnglishMatch() throws Exception {
        Map<String, String> en = load("values"), sk = load("values-sk");
        assertEquals(en.keySet(), sk.keySet());
        for (String k : en.keySet()) {
            assertEquals("placeholders of " + k, placeholders(en.get(k)), placeholders(sk.get(k)));
            assertTrue("empty: " + k, !sk.get(k).trim().isEmpty());
        }
        assertEquals("sk-SK", sk.get("tts_lang"));
        assertEquals("en-US", en.get("tts_lang"));
    }
}
